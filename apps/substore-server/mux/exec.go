package mux

import (
	"encoding/json"
	"fmt"
	"net/http"

	substoreserver "github.com/jvj-wonderland/substore/server"
	"github.com/jvj-wonderland/substore/server/internal/fennel"
	"github.com/jvj-wonderland/substore/server/internal/storage"
	"go.yaml.in/yaml/v4"
)

type ExecHandler struct {
	storage *storage.Storage
	fennel  *fennel.Pool
}

func NewExecMux(storage *storage.Storage, fennel *fennel.Pool) *http.ServeMux {
	h := &ExecHandler{
		storage: storage,
		fennel:  fennel,
	}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /", h.handleExecuteSink)
	return mux
}

func (h *ExecHandler) handleExecuteSink(w http.ResponseWriter, r *http.Request) {
	// Verify name and secret via Basic Auth
	name, pass, ok := r.BasicAuth()
	if !ok {
		w.Header().Set("WWW-Authenticate", `Basic realm="SubStore Sink"`)
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	sink, err := h.storage.GetSink(name)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	if pass != sink.Secret {
		w.Header().Set("WWW-Authenticate", `Basic realm="SubStore Sink"`)
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	sources, err := h.storage.GetAllSources()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	result, err := h.executePipeline(sink, sources)
	if err != nil {
		w.Header().Set("Content-Type", "text/plain; charset=utf-8")
		w.WriteHeader(http.StatusInternalServerError)
		fmt.Fprintf(w, "Pipeline Execution Error: %v", err)
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

func (h *ExecHandler) executePipeline(sink *substoreserver.SubscriptionSink, sources []*storage.Source) (any, error) {
	L := h.fennel.Get()
	defer h.fennel.Put(L)

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
