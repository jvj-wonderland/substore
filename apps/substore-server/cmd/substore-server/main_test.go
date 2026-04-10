package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	substoreserver "github.com/jvj-wonderland/substore/server"
	"github.com/stretchr/testify/assert"
)

func setupTestServer(t *testing.T) (*Server, string) {
	dbFile := "test.db"
	s, err := NewServer(dbFile)
	if err != nil {
		t.Fatal(err)
	}
	return s, dbFile
}

func teardownTestServer(s *Server, dbFile string) {
	s.storage.Close()
	os.Remove(dbFile)
}

func TestAddLocalSource(t *testing.T) {
	s, dbFile := setupTestServer(t)
	defer teardownTestServer(s, dbFile)

	payload := LocalSubscriptionSourcePayload{
		SubscriptionSourcePayload: SubscriptionSourcePayload{
			Name: "test-local",
			Tags: []string{"tag1"},
		},
		Content: "test-content",
	}
	payloadBytes, _ := json.Marshal(payload)
	reqBody := AddSubscriptionSourceRequest{
		Type:    "local",
		Payload: payloadBytes,
	}
	reqBytes, _ := json.Marshal(reqBody)

	req := httptest.NewRequest("POST", "/api/sources", bytes.NewReader(reqBytes))
	w := httptest.NewRecorder()
	s.handleAddSource(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var resp SourceResponse
	json.Unmarshal(w.Body.Bytes(), &resp)
	assert.Equal(t, "test-local", resp.Name)
	assert.Equal(t, "test-content", resp.Content)

	// Update the source
	updatePayload := LocalSubscriptionSourcePayload{
		SubscriptionSourcePayload: SubscriptionSourcePayload{
			Name: "test-local-updated",
		},
	}
	upBytes, _ := json.Marshal(updatePayload)
	upReqBody := AddSubscriptionSourceRequest{
		Type:    "local",
		Payload: upBytes,
	}
	upReqBytes, _ := json.Marshal(upReqBody)

	upReq := httptest.NewRequest("PATCH", "/api/sources/"+resp.ID, bytes.NewReader(upReqBytes))
	upReq.SetPathValue("id", resp.ID)
	upW := httptest.NewRecorder()
	s.handleUpdateSource(upW, upReq)

	assert.Equal(t, http.StatusOK, upW.Code)
	var upResp SourceResponse
	json.Unmarshal(upW.Body.Bytes(), &upResp)
	assert.Equal(t, "test-local-updated", upResp.Name)
	assert.Equal(t, "test-content", upResp.Content) // should remain unchanged if not provided
}

func TestAddSinkAndExecute(t *testing.T) {
	s, dbFile := setupTestServer(t)
	defer teardownTestServer(s, dbFile)

	// Add a local source first
	localPayload := LocalSubscriptionSourcePayload{
		SubscriptionSourcePayload: SubscriptionSourcePayload{
			Name: "src1",
		},
		Content: `{"foo": "bar"}`,
	}
	lpBytes, _ := json.Marshal(localPayload)
	sReqBody := AddSubscriptionSourceRequest{
		Type:    "local",
		Payload: lpBytes,
	}
	sReqBytes, _ := json.Marshal(sReqBody)
	sReq := httptest.NewRequest("POST", "/api/sources", bytes.NewReader(sReqBytes))
	wAdd := httptest.NewRecorder()
	s.handleAddSource(wAdd, sReq)
	assert.Equal(t, http.StatusOK, wAdd.Code, "Adding source failed: "+wAdd.Body.String())

	// Add a sink
	sinkReq := AddSubscriptionSinkRequest{
		Name:           "mysink",
		SinkFormat:     substoreserver.SinkFormatJSON,
		PipelineScript: `*sources*`,
	}
	sinkBytes, _ := json.Marshal(sinkReq)
	req := httptest.NewRequest("POST", "/api/sinks", bytes.NewReader(sinkBytes))
	wSink := httptest.NewRecorder()
	s.handleAddSink(wSink, req)
	assert.Equal(t, http.StatusOK, wSink.Code, "Adding sink failed: "+wSink.Body.String())

	// Update sink
	sinkUpdateReq := AddSubscriptionSinkRequest{
		SinkFormat: substoreserver.SinkFormatYAML,
	}
	sinkUpBytes, _ := json.Marshal(sinkUpdateReq)
	upReq := httptest.NewRequest("PATCH", "/api/sinks/mysink", bytes.NewReader(sinkUpBytes))
	upReq.SetPathValue("name", "mysink")
	upW := httptest.NewRecorder()
	s.handleUpdateSink(upW, upReq)
	assert.Equal(t, http.StatusOK, upW.Code)

	// Execute sink
	execReq := httptest.NewRequest("GET", "/mysink", nil)
	execReq.SetPathValue("name", "mysink")
	wExec := httptest.NewRecorder()
	s.handleExecuteSink(wExec, execReq)

	assert.Equal(t, http.StatusOK, wExec.Code, "Executing sink failed: "+wExec.Body.String())
	assert.Contains(t, wExec.Body.String(), "foo: bar") // YAML output now
}

func TestClientFetchTasks(t *testing.T) {
	s, dbFile := setupTestServer(t)
	defer teardownTestServer(s, dbFile)

	// Add a remote source with browser fetch mode
	remotePayload := RemoteSubscriptionSourcePayload{
		SubscriptionSourcePayload: SubscriptionSourcePayload{
			Name: "remote-browser",
		},
		URL:            "http://example.com",
		FetchMode:      substoreserver.FetchModeBrowser,
		UpdateInterval: 0, // always due
	}
	rpBytes, _ := json.Marshal(remotePayload)
	sReqBody := AddSubscriptionSourceRequest{
		Type:    "remote",
		Payload: rpBytes,
	}
	sReqBytes, _ := json.Marshal(sReqBody)
	sReq := httptest.NewRequest("POST", "/api/sources", bytes.NewReader(sReqBytes))
	w := httptest.NewRecorder()
	s.handleAddSource(w, sReq)

	var sourceResp SourceResponse
	json.Unmarshal(w.Body.Bytes(), &sourceResp)
	id := sourceResp.ID

	// Get tasks
	taskReq := httptest.NewRequest("GET", "/api/tasks", nil)
	w = httptest.NewRecorder()
	s.handleGetTasks(w, taskReq)
	assert.Equal(t, http.StatusOK, w.Code)
	assert.Contains(t, w.Body.String(), id)

	// Upload result
	uploadReq := httptest.NewRequest("POST", "/api/tasks/"+id+"/upload", bytes.NewReader([]byte("fetched-content")))
	uploadReq.SetPathValue("id", id)
	w = httptest.NewRecorder()
	s.handleUploadTaskResult(w, uploadReq)
	assert.Equal(t, http.StatusOK, w.Code)

	// Verify content in storage
	src, _ := s.storage.GetSource(id)
	assert.Equal(t, "fetched-content", src.Content)
}

func TestEval(t *testing.T) {
	s, dbFile := setupTestServer(t)
	defer teardownTestServer(s, dbFile)

	// Add a local source first
	localPayload := LocalSubscriptionSourcePayload{
		SubscriptionSourcePayload: SubscriptionSourcePayload{
			Name: "src1",
		},
		Content: `{"foo": "bar"}`,
	}
	lpBytes, _ := json.Marshal(localPayload)
	sReqBody := AddSubscriptionSourceRequest{
		Type:    "local",
		Payload: lpBytes,
	}
	sReqBytes, _ := json.Marshal(sReqBody)
	sReq := httptest.NewRequest("POST", "/api/sources", bytes.NewReader(sReqBytes))
	wAdd := httptest.NewRecorder()
	s.handleAddSource(wAdd, sReq)
	assert.Equal(t, http.StatusOK, wAdd.Code)

	evalReq := EvalRequest{
		Script: `(do (print "hello") (+ 1 (length *sources*)))`,
	}
	evalBytes, _ := json.Marshal(evalReq)
	req := httptest.NewRequest("POST", "/api/eval", bytes.NewReader(evalBytes))
	w := httptest.NewRecorder()
	s.handleEval(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Eval failed with status %d: %s", w.Code, w.Body.String())
		return
	}

	var resp EvalResponse
	json.Unmarshal(w.Body.Bytes(), &resp)
	assert.Equal(t, float64(2), resp.Result) // 1 source + 1 = 2
	assert.Equal(t, "hello\n", resp.Stdout)
}

func TestJSONToFennel(t *testing.T) {
	s, dbFile := setupTestServer(t)
	defer teardownTestServer(s, dbFile)

	reqBody := JSONToFennelRequest{
		Content: `{"foo": "bar", "list": [1, 2, 3]}`,
	}
	reqBytes, _ := json.Marshal(reqBody)

	req := httptest.NewRequest("POST", "/api/utils/json-to-fennel", bytes.NewReader(reqBytes))
	w := httptest.NewRecorder()
	s.handleJSONToFennel(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var resp JSONToFennelResponse
	json.Unmarshal(w.Body.Bytes(), &resp)
	assert.Contains(t, resp.Fennel, `:foo "bar"`)
	assert.Contains(t, resp.Fennel, `:list [1 2 3]`)
}

