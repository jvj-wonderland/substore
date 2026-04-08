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
	"github.com/jvj-wonderland/substore/server/internal/chibi"
	"github.com/jvj-wonderland/substore/server/internal/storage"
	"go.yaml.in/yaml/v4"
)

type Server struct {
	storage *storage.Storage
	chibi   *chibi.Pool
}

func NewServer(dbPath string) (*Server, error) {
	s, err := storage.NewStorage(dbPath)
	if err != nil {
		return nil, err
	}
	return &Server{
		storage: s,
		chibi:   chibi.NewPool(),
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
	apiMux.HandleFunc("GET /tasks", s.handleGetTasks)
	apiMux.HandleFunc("POST /tasks/{id}/upload", s.handleUploadTaskResult)

	mux.Handle("/api/", http.StripPrefix("/api", apiMux))

	log.Println("Server starting on :8080")
	http.ListenAndServe(":8080", mux)
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
	json.NewEncoder(w).Encode(source)
}

func (s *Server) handleGetSources(w http.ResponseWriter, r *http.Request) {
	sources, err := s.storage.GetAllSources()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(sources)
}

func (s *Server) handleAddSink(w http.ResponseWriter, r *http.Request) {
	var req AddSubscriptionSinkRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	sink := &substoreserver.SubscriptionSink{
		Name:           req.Name,
		SinkFormat:     req.SinkFormat,
		PipelineScript: req.PipelineScript,
	}

	if err := s.storage.AddSink(sink); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(sink)
}

func (s *Server) handleGetSinks(w http.ResponseWriter, r *http.Request) {
	sinks, err := s.storage.GetAllSinks()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(sinks)
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
	parent := s.chibi.Get()
	defer s.chibi.Put(parent)

	// Spawn a child context to ensure environment isolation
	ctx := parent.ChildContext()

	var sourceList []map[string]any
	for _, src := range sources {
		// Only include sources that have content
		if src.Content == "" {
			continue
		}

		// Try to parse content as JSON or YAML for easier manipulation in scheme
		var content any
		if err := json.Unmarshal([]byte(src.Content), &content); err != nil {
			if err := yaml.Unmarshal([]byte(src.Content), &content); err != nil {
				// If neither, just use as raw string
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

	if err := ctx.Define("sources", sourceList); err != nil {
		return nil, fmt.Errorf("failed to define sources: %v", err)
	}

	return ctx.Execute(sink.PipelineScript)
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

type AddSubscriptionSourceRequest struct {
	Type    string          `json:"type"`
	Payload json.RawMessage `json:"payload"`
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

type AddSubscriptionSinkRequest struct {
	Name           string                    `json:"name"`
	SinkFormat     substoreserver.SinkFormat `json:"sink_format"`
	PipelineScript string                    `json:"pipeline_script"`
}
