package main

import (
	"context"
	"embed"
	"encoding/json"
	"fmt"
	"io"
	"io/fs"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
	substoreserver "github.com/jvj-wonderland/substore/server"
	"github.com/jvj-wonderland/substore/server/internal/fennel"
	"github.com/jvj-wonderland/substore/server/internal/storage"
	"go.yaml.in/yaml/v4"
)

//go:embed all:dist
var uiDist embed.FS

type Server struct {
	storage *storage.Storage
	fennel  *fennel.Pool
}

func NewServer(dbPath string) (*Server, error) {
	s, err := storage.NewStorage(dbPath)
	if err != nil {
		return nil, err
	}
	return &Server{
		storage: s,
		fennel:  fennel.NewPool(),
	}, nil
}

func main() {
	s, err := NewServer("substore.db")
	if err != nil {
		log.Fatal(err)
	}
	defer s.storage.Close()

	go s.startBackgroundFetcher(context.Background())

	// Management API
	apiMux := http.NewServeMux()
	apiMux.HandleFunc("POST /sources", s.handleAddSource)
	apiMux.HandleFunc("GET /sources", s.handleGetSources)
	apiMux.HandleFunc("GET /sources/{id}", s.handleGetSource)
	apiMux.HandleFunc("PUT /sources/{id}", s.handleUpdateSource)
	apiMux.HandleFunc("PATCH /sources/{id}", s.handleUpdateSource)

	apiMux.HandleFunc("POST /sinks", s.handleAddSink)
	apiMux.HandleFunc("GET /sinks", s.handleGetSinks)
	apiMux.HandleFunc("PUT /sinks/{name}", s.handleUpdateSink)
	apiMux.HandleFunc("PATCH /sinks/{name}", s.handleUpdateSink)

	apiMux.HandleFunc("POST /eval", s.handleEval)
	apiMux.HandleFunc("GET /tasks", s.handleGetTasks)
	apiMux.HandleFunc("POST /tasks/{id}/upload", s.handleUploadTaskResult)
	apiMux.HandleFunc("POST /utils/json-to-fennel", s.handleJSONToFennel)

	// Combined Mux for Management Port
	managementMux := http.NewServeMux()
	managementMux.Handle("/api/", http.StripPrefix("/api", apiMux))

	// Serve SPA
	uiFS, err := fs.Sub(uiDist, "dist")
	if err != nil {
		log.Fatal(err)
	}
	fileServer := http.FileServer(http.FS(uiFS))

	managementMux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		// If it's an API call, it should have been caught by /api/ prefix
		// but just in case or for other root paths:
		if strings.HasPrefix(r.URL.Path, "/api") {
			http.NotFound(w, r)
			return
		}

		// Check if file exists in embedded FS
		f, err := uiFS.Open(strings.TrimPrefix(r.URL.Path, "/"))
		if err == nil {
			f.Close()
			fileServer.ServeHTTP(w, r)
			return
		}

		// Fallback to index.html for SPA routing
		index, err := uiDist.ReadFile("dist/index.html")
		if err != nil {
			http.Error(w, "SPA not found", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Write(index)
	})

	// Execution API
	execMux := http.NewServeMux()
	execMux.HandleFunc("GET /{name}", s.handleExecuteSink)

	go func() {
		log.Println("Management API and SPA starting on :8080")
		if err := http.ListenAndServe(":8080", managementMux); err != nil {
			log.Fatalf("Management API failed: %v", err)
		}
	}()

	log.Println("Execution API starting on :8001")
	if err := http.ListenAndServe(":8001", execMux); err != nil {
		log.Fatalf("Execution API failed: %v", err)
	}
}

type SubscriptionSourcePayload struct {
	Name string   `json:"name"`
	Tags []string `json:"tags"`
}

type RemoteSubscriptionSourcePayload struct {
	SubscriptionSourcePayload
	URL            string                   `json:"url"`
	FetchMode      substoreserver.FetchMode `json:"fetch_mode"`
	UpdateInterval int64                    `json:"update_interval"`
}

type LocalSubscriptionSourcePayload struct {
	SubscriptionSourcePayload
	Content string `json:"content"`
}

func (s *Server) handleAddSource(w http.ResponseWriter, r *http.Request) {
	var req AddSubscriptionSourceRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	id := uuid.New().String()
	source := &storage.Source{
		ID: id,
	}

	if err := s.applySourcePayload(source, req.Type, req.Payload); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if err := s.storage.AddSource(source); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(s.toSourceResponse(source))
}

func (s *Server) handleUpdateSource(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	source, err := s.storage.GetSource(id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	var req AddSubscriptionSourceRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if err := s.applySourcePayload(source, req.Type, req.Payload); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if err := s.storage.AddSource(source); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(s.toSourceResponse(source))
}

func (s *Server) applySourcePayload(source *storage.Source, sourceType string, payload json.RawMessage) error {
	switch sourceType {
	case "local":
		var p LocalSubscriptionSourcePayload
		if err := json.Unmarshal(payload, &p); err != nil {
			return err
		}
		source.Type = "local"
		if p.Name != "" {
			source.Name = p.Name
		}
		if p.Tags != nil {
			source.Tags = p.Tags
		}
		if p.Content != "" {
			source.Content = p.Content
		}
	case "remote":
		var p RemoteSubscriptionSourcePayload
		if err := json.Unmarshal(payload, &p); err != nil {
			return err
		}
		source.Type = "remote"
		if p.Name != "" {
			source.Name = p.Name
		}
		if p.Tags != nil {
			source.Tags = p.Tags
		}
		if p.URL != "" {
			source.URL = p.URL
		}
		source.FetchMode = p.FetchMode
		if p.UpdateInterval != 0 {
			source.UpdateInterval = p.UpdateInterval
		}
	default:
		return fmt.Errorf("invalid source type: %s", sourceType)
	}
	return nil
}

func (s *Server) handleGetSources(w http.ResponseWriter, r *http.Request) {
	sources, err := s.storage.GetAllSources()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	resp := []SourceResponse{}
	for _, source := range sources {
		resp = append(resp, s.toSourceResponse(source))
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func (s *Server) handleGetSource(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	source, err := s.storage.GetSource(id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(s.toSourceResponse(source))
}

type JSONToFennelRequest struct {
	Content string `json:"content"`
}

type JSONToFennelResponse struct {
	Fennel string `json:"fennel"`
}

func (s *Server) handleJSONToFennel(w http.ResponseWriter, r *http.Request) {
	var req JSONToFennelRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	var content any
	if err := json.Unmarshal([]byte(req.Content), &content); err != nil {
		if err := yaml.Unmarshal([]byte(req.Content), &content); err != nil {
			http.Error(w, "invalid JSON or YAML: "+err.Error(), http.StatusBadRequest)
			return
		}
	}

	L := s.fennel.Get()
	defer s.fennel.Put(L)

	fennelStr, err := fennel.ToFennel(L, content)
	if err != nil {
		http.Error(w, "failed to convert to fennel: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(JSONToFennelResponse{Fennel: fennelStr})
}

func (s *Server) handleAddSink(w http.ResponseWriter, r *http.Request) {
	var req AddSubscriptionSinkRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	sink := &substoreserver.SubscriptionSink{
		Name: req.Name,
	}

	if err := s.applySinkPayload(sink, &req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if err := s.storage.AddSink(sink); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(s.toSinkResponse(sink))
}

func (s *Server) handleUpdateSink(w http.ResponseWriter, r *http.Request) {
	name := r.PathValue("name")
	sink, err := s.storage.GetSink(name)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	var req AddSubscriptionSinkRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if err := s.applySinkPayload(sink, &req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if err := s.storage.AddSink(sink); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(s.toSinkResponse(sink))
}

func (s *Server) applySinkPayload(sink *substoreserver.SubscriptionSink, req *AddSubscriptionSinkRequest) error {
	if req.SinkFormat != 0 {
		sink.SinkFormat = req.SinkFormat
	}
	if req.PipelineScript != "" {
		L := s.fennel.Get()
		defer s.fennel.Put(L)

		compiled, err := fennel.Compile(L, req.PipelineScript)
		if err != nil {
			return fmt.Errorf("failed to compile script: %v", err)
		}
		sink.PipelineScript = req.PipelineScript
		sink.CompiledPipelineScript = compiled
	}
	return nil
}

func (s *Server) handleGetSinks(w http.ResponseWriter, r *http.Request) {
	sinks, err := s.storage.GetAllSinks()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	resp := []SinkResponse{}
	for _, sink := range sinks {
		resp = append(resp, s.toSinkResponse(sink))
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func (s *Server) handleExecuteSink(w http.ResponseWriter, r *http.Request) {
	name := r.PathValue("name")
	sink, err := s.storage.GetSink(name)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	sources, err := s.storage.GetAllSources()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	result, err := s.executePipeline(sink, sources)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	var output []byte
	switch sink.SinkFormat {
	case substoreserver.SinkFormatJSON:
		w.Header().Set("Content-Type", "application/json")
		output, _ = json.MarshalIndent(result, "", "  ")
	case substoreserver.SinkFormatYAML:
		w.Header().Set("Content-Type", "application/x-yaml")
		output, _ = yaml.Marshal(result)
	}
	w.Write(output)
}

func (s *Server) executePipeline(sink *substoreserver.SubscriptionSink, sources []*storage.Source) (any, error) {
	L := s.fennel.Get()
	defer s.fennel.Put(L)

	var sourceList []map[string]any
	for _, src := range sources {
		if src.Content == "" {
			continue
		}

		var content any
		if err := json.Unmarshal([]byte(src.Content), &content); err != nil {
			if err := yaml.Unmarshal([]byte(src.Content), &content); err != nil {
				content = src.Content
			}
		}

		sourceList = append(sourceList, map[string]any{
			"id":      src.ID,
			"name":    src.Name,
			"tags":    src.Tags,
			"content": content,
		})
	}

	lSources := fennel.MapToLua(L, sourceList)
	L.SetGlobal("__fnl_global___2asources_2a", lSources)

	script := sink.CompiledPipelineScript
	if script == "" {
		var err error
		script, err = fennel.Compile(L, sink.PipelineScript)
		if err != nil {
			return nil, fmt.Errorf("failed to compile script: %v", err)
		}
	}

	if err := L.DoString(script); err != nil {
		return nil, fmt.Errorf("failed to execute script: %v", err)
	}

	ret := L.Get(-1)
	L.Pop(1)

	return fennel.MapToGo(ret), nil
}

func (s *Server) handleGetTasks(w http.ResponseWriter, r *http.Request) {
	sources, err := s.storage.GetAllSources()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	var tasks []*storage.Source
	now := time.Now().Unix()
	for _, src := range sources {
		if src.Type == "remote" && src.FetchMode == substoreserver.FetchModeBrowser {
			if src.LastUpdated == 0 || now > src.LastUpdated+src.UpdateInterval {
				tasks = append(tasks, src)
			}
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(tasks)
}

func (s *Server) handleUploadTaskResult(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	src, err := s.storage.GetSource(id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	content, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	src.Content = string(content)
	src.LastUpdated = time.Now().Unix()

	if err := s.storage.AddSource(src); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
}

func (s *Server) startBackgroundFetcher(ctx context.Context) {
	ticker := time.NewTicker(1 * time.Minute)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			s.fetchServerSources()
		}
	}
}

func (s *Server) fetchServerSources() {
	sources, err := s.storage.GetAllSources()
	if err != nil {
		log.Printf("failed to get sources: %v", err)
		return
	}

	now := time.Now().Unix()
	for _, src := range sources {
		if src.Type == "remote" && src.FetchMode == substoreserver.FetchModeServer {
			if src.LastUpdated == 0 || now > src.LastUpdated+src.UpdateInterval {
				go s.fetchSource(src)
			}
		}
	}
}

func (s *Server) fetchSource(src *storage.Source) {
	log.Printf("fetching source %s from %s", src.Name, src.URL)
	resp, err := http.Get(src.URL)
	if err != nil {
		log.Printf("failed to fetch %s: %v", src.URL, err)
		return
	}
	defer resp.Body.Close()

	content, err := io.ReadAll(resp.Body)
	if err != nil {
		log.Printf("failed to read body of %s: %v", src.URL, err)
		return
	}

	src.Content = string(content)
	src.LastUpdated = time.Now().Unix()

	if err := s.storage.AddSource(src); err != nil {
		log.Printf("failed to update source %s: %v", src.Name, err)
	}
}

func (s *Server) handleEval(w http.ResponseWriter, r *http.Request) {
	var req EvalRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	sources, err := s.storage.GetAllSources()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	L := s.fennel.Get()
	defer s.fennel.Put(L)

	var sourceList []map[string]any
	for _, src := range sources {
		if src.Content == "" {
			continue
		}
		var content any
		if err := json.Unmarshal([]byte(src.Content), &content); err != nil {
			if err := yaml.Unmarshal([]byte(src.Content), &content); err != nil {
				content = src.Content
			}
		}
		sourceList = append(sourceList, map[string]any{
			"id":      src.ID,
			"name":    src.Name,
			"tags":    src.Tags,
			"content": content,
		})
	}

	lSources := fennel.MapToLua(L, sourceList)
	L.SetGlobal("__fnl_global___2asources_2a", lSources)

	result, stdout, stderr, err := fennel.EvalWithOutput(L, req.Script)
	resp := EvalResponse{
		Stdout: stdout,
		Stderr: stderr,
	}
	if err != nil {
		resp.Error = err.Error()
		w.WriteHeader(http.StatusInternalServerError)
	} else {
		resp.Result = fennel.MapToGo(result)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func (s *Server) toSourceResponse(source *storage.Source) SourceResponse {
	tags := source.Tags
	if tags == nil {
		tags = []string{}
	}
	return SourceResponse{
		ID:             source.ID,
		Type:           source.Type,
		Name:           source.Name,
		Tags:           tags,
		URL:            source.URL,
		FetchMode:      source.FetchMode,
		UpdateInterval: source.UpdateInterval,
		LastUpdated:    source.LastUpdated,
		Content:        source.Content,
	}
}

func (s *Server) toSinkResponse(sink *substoreserver.SubscriptionSink) SinkResponse {
	return SinkResponse{
		Name:           sink.Name,
		SinkFormat:     sink.SinkFormat,
		PipelineScript: sink.PipelineScript,
	}
}

type EvalRequest struct {
	Script     string                    `json:"script"`
	SinkFormat substoreserver.SinkFormat `json:"sink_format"`
}

type EvalResponse struct {
	Result any    `json:"result"`
	Stdout string `json:"stdout"`
	Stderr string `json:"stderr"`
	Error  string `json:"error,omitempty"`
}

type AddSubscriptionSourceRequest struct {
	Type    string          `json:"type"`
	Payload json.RawMessage `json:"payload"`
}

type AddSubscriptionSinkRequest struct {
	Name           string                    `json:"name"`
	SinkFormat     substoreserver.SinkFormat `json:"sink_format"`
	PipelineScript string                    `json:"pipeline_script"`
}

type SourceResponse struct {
	ID             string                   `json:"id"`
	Type           string                   `json:"type"`
	Name           string                   `json:"name"`
	Tags           []string                 `json:"tags"`
	URL            string                   `json:"url,omitempty"`
	FetchMode      substoreserver.FetchMode `json:"fetch_mode,omitempty"`
	UpdateInterval int64                    `json:"update_interval,omitempty"`
	LastUpdated    int64                    `json:"last_updated,omitempty"`
	Content        string                   `json:"content"`
}

type SinkResponse struct {
	Name           string                    `json:"name"`
	SinkFormat     substoreserver.SinkFormat `json:"sink_format"`
	PipelineScript string                    `json:"pipeline_script"`
}
