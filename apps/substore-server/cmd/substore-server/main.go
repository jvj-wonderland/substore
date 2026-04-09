package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"time"

	"github.com/google/uuid"
	substoreserver "github.com/jvj-wonderland/substore/server"
	"github.com/jvj-wonderland/substore/server/internal/fennel"
	"github.com/jvj-wonderland/substore/server/internal/storage"
	"go.yaml.in/yaml/v4"
)

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

	mux := http.NewServeMux()
	mux.HandleFunc("GET /", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("SubStore Server"))
	})

	apiMux := http.NewServeMux()
	apiMux.HandleFunc("POST /sources", s.handleAddSource)
	apiMux.HandleFunc("GET /sources", s.handleGetSources)
	apiMux.HandleFunc("POST /sinks", s.handleAddSink)
	apiMux.HandleFunc("GET /sinks", s.handleGetSinks)
	apiMux.HandleFunc("GET /sinks/{name}", s.handleExecuteSink)
	apiMux.HandleFunc("POST /eval", s.handleEval)
	apiMux.HandleFunc("GET /tasks", s.handleGetTasks)
	apiMux.HandleFunc("POST /tasks/{id}/upload", s.handleUploadTaskResult)

	mux.Handle("/api/", http.StripPrefix("/api", apiMux))

	log.Println("Server starting on :8080")
	http.ListenAndServe(":8080", mux)
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

	switch req.Type {
	case "local":
		var payload LocalSubscriptionSourcePayload
		if err := json.Unmarshal(req.Payload, &payload); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		source.Type = "local"
		source.Name = payload.Name
		source.Tags = payload.Tags
		source.Content = payload.Content
	case "remote":
		var payload RemoteSubscriptionSourcePayload
		if err := json.Unmarshal(req.Payload, &payload); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		source.Type = "remote"
		source.Name = payload.Name
		source.Tags = payload.Tags
		source.URL = payload.URL
		source.FetchMode = payload.FetchMode
		source.UpdateInterval = payload.UpdateInterval
	default:
		http.Error(w, "invalid source type", http.StatusBadRequest)
		return
	}

	if err := s.storage.AddSource(source); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(SourceResponse{
		ID:             source.ID,
		Type:           source.Type,
		Name:           source.Name,
		Tags:           source.Tags,
		URL:            source.URL,
		FetchMode:      source.FetchMode,
		UpdateInterval: source.UpdateInterval,
		LastUpdated:    source.LastUpdated,
		Content:        source.Content,
	})
}

func (s *Server) handleGetSources(w http.ResponseWriter, r *http.Request) {
	sources, err := s.storage.GetAllSources()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	var resp []SourceResponse
	for _, source := range sources {
		resp = append(resp, SourceResponse{
			ID:             source.ID,
			Type:           source.Type,
			Name:           source.Name,
			Tags:           source.Tags,
			URL:            source.URL,
			FetchMode:      source.FetchMode,
			UpdateInterval: source.UpdateInterval,
			LastUpdated:    source.LastUpdated,
			Content:        source.Content,
		})
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func (s *Server) handleAddSink(w http.ResponseWriter, r *http.Request) {
	var req AddSubscriptionSinkRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	L := s.fennel.Get()
	defer s.fennel.Put(L)

	compiled, err := fennel.Compile(L, req.PipelineScript)
	if err != nil {
		http.Error(w, fmt.Sprintf("failed to compile script: %v", err), http.StatusBadRequest)
		return
	}

	sink := &substoreserver.SubscriptionSink{
		Name:                   req.Name,
		SinkFormat:             req.SinkFormat,
		PipelineScript:         req.PipelineScript,
		CompiledPipelineScript: compiled,
	}

	if err := s.storage.AddSink(sink); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(SinkResponse{
		Name:           sink.Name,
		SinkFormat:     sink.SinkFormat,
		PipelineScript: sink.PipelineScript,
	})
}

func (s *Server) handleGetSinks(w http.ResponseWriter, r *http.Request) {
	sinks, err := s.storage.GetAllSinks()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	var resp []SinkResponse
	for _, sink := range sinks {
		resp = append(resp, SinkResponse{
			Name:           sink.Name,
			SinkFormat:     sink.SinkFormat,
			PipelineScript: sink.PipelineScript,
		})
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

	L.SetGlobal("__fnl_global___2asources_2a", fennel.MapToLua(L, sourceList))

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

	L.SetGlobal("__fnl_global___2asources_2a", fennel.MapToLua(L, sourceList))

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
