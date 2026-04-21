package mux

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/google/uuid"
	substoreserver "github.com/jvj-wonderland/substore/server"
	"github.com/jvj-wonderland/substore/server/internal/fennel"
	"github.com/jvj-wonderland/substore/server/internal/storage"
	"go.yaml.in/yaml/v4"
)

type AdminHandler struct {
	storage *storage.Storage
	fennel  *fennel.Pool
}

func NewAdminMux(storage *storage.Storage, fennel *fennel.Pool) *http.ServeMux {
	h := &AdminHandler{
		storage: storage,
		fennel:  fennel,
	}
	mux := http.NewServeMux()
	mux.HandleFunc("POST /sources", h.handleAddSource)
	mux.HandleFunc("GET /sources", h.handleGetSources)
	mux.HandleFunc("GET /sources/{id}", h.handleGetSource)
	mux.HandleFunc("PUT /sources/{id}", h.handleUpdateSource)
	mux.HandleFunc("PATCH /sources/{id}", h.handleUpdateSource)
	mux.HandleFunc("DELETE /sources/{id}", h.handleDeleteSource)

	mux.HandleFunc("POST /sinks", h.handleAddSink)
	mux.HandleFunc("GET /sinks", h.handleGetSinks)
	mux.HandleFunc("PUT /sinks/{id}", h.handleUpdateSink)
	mux.HandleFunc("PATCH /sinks/{id}", h.handleUpdateSink)
	mux.HandleFunc("POST /sinks/{id}/secret", h.handleRegenerateSinkSecret)
	mux.HandleFunc("DELETE /sinks/{id}", h.handleDeleteSink)

	mux.HandleFunc("POST /fennel/eval", h.handleEval)
	mux.HandleFunc("POST /fennel/convert", h.handleConvertFennel)
	mux.HandleFunc("GET /tasks", h.handleGetTasks)
	mux.HandleFunc("POST /tasks/{id}/upload", h.handleUploadTaskResult)
	return mux
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

func (h *AdminHandler) handleAddSource(w http.ResponseWriter, r *http.Request) {
	var req AddSubscriptionSourceRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	id := uuid.New().String()
	source := &storage.Source{
		ID: id,
	}

	if err := h.applySourcePayload(source, req.Type, req.Payload); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if err := h.ensureSourceNameAvailable(source.Name, source.ID); err != nil {
		h.writeNameConflictError(w, err)
		return
	}

	if err := h.storage.AddSource(source); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(h.toSourceResponse(source))
}

func (h *AdminHandler) handleUpdateSource(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	source, err := h.storage.GetSource(id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	var req AddSubscriptionSourceRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if err := h.applySourcePayload(source, req.Type, req.Payload); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if err := h.ensureSourceNameAvailable(source.Name, source.ID); err != nil {
		h.writeNameConflictError(w, err)
		return
	}

	if err := h.storage.AddSource(source); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(h.toSourceResponse(source))
}

func (h *AdminHandler) applySourcePayload(source *storage.Source, sourceType string, payload json.RawMessage) error {
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

func (h *AdminHandler) handleGetSources(w http.ResponseWriter, r *http.Request) {
	sources, err := h.storage.GetAllSources()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	resp := []SourceResponse{}
	for _, source := range sources {
		resp = append(resp, h.toSourceResponse(source))
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func (h *AdminHandler) handleGetSource(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	source, err := h.storage.GetSource(id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(h.toSourceResponse(source))
}

type ConvertFennelRequest struct {
	Content string `json:"content"`
}

type ConvertFennelResponse struct {
	Fennel string `json:"fennel"`
}

func (h *AdminHandler) handleConvertFennel(w http.ResponseWriter, r *http.Request) {
	var req ConvertFennelRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	var content any
	if err := yaml.Unmarshal([]byte(req.Content), &content); err != nil {
		http.Error(w, "invalid YAML: "+err.Error(), http.StatusBadRequest)
		return
	}

	L := h.fennel.Get()
	defer h.fennel.Put(L)

	fennelStr, err := fennel.ToFennel(L, content)
	if err != nil {
		http.Error(w, "failed to convert to fennel: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(ConvertFennelResponse{Fennel: fennelStr})
}

func generateSecret() (string, error) {
	b := make([]byte, 48)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

func (h *AdminHandler) handleDeleteSource(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if err := h.storage.DeleteSource(id); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *AdminHandler) handleDeleteSink(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if err := h.storage.DeleteSink(id); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *AdminHandler) handleAddSink(w http.ResponseWriter, r *http.Request) {
	var req AddSubscriptionSinkRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	secret := req.Secret
	if secret == "" {
		var err error
		secret, err = generateSecret()
		if err != nil {
			http.Error(w, "failed to generate sink secret", http.StatusInternalServerError)
			return
		}
	}

	sink := &substoreserver.SubscriptionSink{
		ID:     uuid.New().String(),
		Name:   req.Name,
		Secret: secret,
	}

	if err := h.applySinkPayload(sink, &req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if err := h.ensureSinkNameAvailable(sink.Name, sink.ID); err != nil {
		h.writeNameConflictError(w, err)
		return
	}

	if err := h.storage.AddSink(sink); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(h.toSinkResponse(sink))
}

func (h *AdminHandler) handleUpdateSink(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	sink, err := h.storage.GetSink(id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	var req AddSubscriptionSinkRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if req.Name != "" {
		sink.Name = req.Name
	}

	if req.Secret != "" {
		sink.Secret = req.Secret
	} else if sink.Secret == "" {
		var err error
		sink.Secret, err = generateSecret()
		if err != nil {
			http.Error(w, "failed to generate sink secret", http.StatusInternalServerError)
			return
		}
	}

	if err := h.applySinkPayload(sink, &req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if err := h.ensureSinkNameAvailable(sink.Name, sink.ID); err != nil {
		h.writeNameConflictError(w, err)
		return
	}

	if err := h.storage.AddSink(sink); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(h.toSinkResponse(sink))
}

func (h *AdminHandler) handleRegenerateSinkSecret(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	sink, err := h.storage.GetSink(id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	secret, err := generateSecret()
	if err != nil {
		http.Error(w, "failed to generate sink secret", http.StatusInternalServerError)
		return
	}
	sink.Secret = secret

	if err := h.storage.AddSink(sink); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(h.toSinkResponse(sink))
}

func (h *AdminHandler) applySinkPayload(sink *substoreserver.SubscriptionSink, req *AddSubscriptionSinkRequest) error {
	sink.SinkFormat = req.SinkFormat
	if req.PipelineScript != "" {
		L := h.fennel.Get()
		defer h.fennel.Put(L)

		compiled, err := fennel.Compile(L, req.PipelineScript)
		if err != nil {
			return fmt.Errorf("failed to compile script: %v", err)
		}
		sink.PipelineScript = req.PipelineScript
		sink.CompiledPipelineScript = compiled
	}
	return nil
}

type nameConflictError struct {
	resource string
	name     string
}

func (e *nameConflictError) Error() string {
	return fmt.Sprintf("%s name already exists: %s", e.resource, e.name)
}

func (h *AdminHandler) writeNameConflictError(w http.ResponseWriter, err error) {
	if _, ok := err.(*nameConflictError); ok {
		http.Error(w, err.Error(), http.StatusConflict)
		return
	}
	http.Error(w, err.Error(), http.StatusInternalServerError)
}

func (h *AdminHandler) ensureSourceNameAvailable(name string, currentID string) error {
	sources, err := h.storage.GetAllSources()
	if err != nil {
		return err
	}

	for _, source := range sources {
		if source.ID != currentID && source.Name == name {
			return &nameConflictError{resource: "source", name: name}
		}
	}
	return nil
}

func (h *AdminHandler) ensureSinkNameAvailable(name string, currentID string) error {
	sinks, err := h.storage.GetAllSinks()
	if err != nil {
		return err
	}

	for _, sink := range sinks {
		if sink.ID != currentID && sink.Name == name {
			return &nameConflictError{resource: "sink", name: name}
		}
	}
	return nil
}

func (h *AdminHandler) handleGetSinks(w http.ResponseWriter, r *http.Request) {
	sinks, err := h.storage.GetAllSinks()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	resp := []SinkResponse{}
	for _, sink := range sinks {
		resp = append(resp, h.toSinkResponse(sink))
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func (h *AdminHandler) handleGetTasks(w http.ResponseWriter, r *http.Request) {
	sources, err := h.storage.GetAllSources()
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

func (h *AdminHandler) handleUploadTaskResult(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	src, err := h.storage.GetSource(id)
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

	if err := h.storage.AddSource(src); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
}

func (h *AdminHandler) handleEval(w http.ResponseWriter, r *http.Request) {
	var req EvalRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	sources, err := h.storage.GetAllSources()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

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

	compiled, compileErr := fennel.Compile(L, req.Script)
	resp := EvalResponse{
		CompiledScript: compiled,
	}

	if compileErr != nil {
		resp.Error = "Compile Error: " + compileErr.Error()
	} else {
		result, stdout, stderr, err := fennel.EvalWithOutput(L, req.Script)
		resp.Stdout = stdout
		resp.Stderr = stderr
		if err != nil {
			resp.Error = "Runtime Error: " + err.Error()
		} else {
			// Map the Lua result to a Go object (map, slice, string, etc.)
			val := fennel.MapToGo(result)
			resp.Result = val

			// Serialize the Go object into the requested format for ResultString
			var b []byte
			var mErr error
			if req.SinkFormat == substoreserver.SinkFormatYAML {
				b, mErr = yaml.Marshal(val)
			} else {
				b, mErr = json.MarshalIndent(val, "", "  ")
			}

			if mErr != nil {
				resp.Error = "Serialization Error: " + mErr.Error()
			} else {
				resp.ResultString = string(b)
			}
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func (h *AdminHandler) toSourceResponse(source *storage.Source) SourceResponse {
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

func (h *AdminHandler) toSinkResponse(sink *substoreserver.SubscriptionSink) SinkResponse {
	return SinkResponse{
		ID:             sink.ID,
		Name:           sink.Name,
		Secret:         sink.Secret,
		SinkFormat:     sink.SinkFormat,
		PipelineScript: sink.PipelineScript,
	}
}

type EvalRequest struct {
	Script     string                    `json:"script"`
	SinkFormat substoreserver.SinkFormat `json:"sink_format"`
}

type EvalResponse struct {
	Result         any    `json:"result"`
	ResultString   string `json:"result_string,omitempty"`
	CompiledScript string `json:"compiled_script,omitempty"`
	Stdout         string `json:"stdout"`
	Stderr         string `json:"stderr"`
	Error          string `json:"error,omitempty"`
}

type AddSubscriptionSourceRequest struct {
	Type    string          `json:"type"`
	Payload json.RawMessage `json:"payload"`
}

type AddSubscriptionSinkRequest struct {
	Name           string                    `json:"name"`
	Secret         string                    `json:"secret"`
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
	ID             string                    `json:"id"`
	Name           string                    `json:"name"`
	Secret         string                    `json:"secret"`
	SinkFormat     substoreserver.SinkFormat `json:"sink_format"`
	PipelineScript string                    `json:"pipeline_script"`
}
