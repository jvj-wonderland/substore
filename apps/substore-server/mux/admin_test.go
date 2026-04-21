package mux

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	substoreserver "github.com/jvj-wonderland/substore/server"
	"github.com/jvj-wonderland/substore/server/internal/fennel"
	"github.com/jvj-wonderland/substore/server/internal/storage"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setupTestMux(t *testing.T) (*http.ServeMux, *storage.Storage, string) {
	tmpfile, err := os.CreateTemp("", "substore-test-*.db")
	if err != nil {
		t.Fatal(err)
	}
	tmpfile.Close()
	dbFile := tmpfile.Name()

	s, err := storage.NewStorage(dbFile)
	if err != nil {
		t.Fatal(err)
	}
	pool := fennel.NewPool()
	m := NewAdminMux(s, pool)
	return m, s, dbFile
}

func teardownTestMux(s *storage.Storage, dbFile string) {
	s.Close()
	os.Remove(dbFile)
}

func TestAddLocalSource(t *testing.T) {
	m, s, dbFile := setupTestMux(t)
	defer teardownTestMux(s, dbFile)

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

	req := httptest.NewRequest("POST", "/sources", bytes.NewReader(reqBytes))

	w := httptest.NewRecorder()
	m.ServeHTTP(w, req)

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

	upReq := httptest.NewRequest("PATCH", "/sources/"+resp.ID, bytes.NewReader(upReqBytes))
	upW := httptest.NewRecorder()
	m.ServeHTTP(upW, upReq)

	assert.Equal(t, http.StatusOK, upW.Code)
	var upResp SourceResponse
	json.Unmarshal(upW.Body.Bytes(), &upResp)
	assert.Equal(t, "test-local-updated", upResp.Name)
	assert.Equal(t, "test-content", upResp.Content) // should remain unchanged if not provided
}

func TestSourceNameConflicts(t *testing.T) {
	m, s, dbFile := setupTestMux(t)
	defer teardownTestMux(s, dbFile)

	firstID := addLocalSourceForTest(t, m, "first-source")
	secondID := addLocalSourceForTest(t, m, "second-source")

	duplicatePayload := LocalSubscriptionSourcePayload{
		SubscriptionSourcePayload: SubscriptionSourcePayload{
			Name: "first-source",
		},
		Content: "duplicate-content",
	}
	duplicateBytes, err := json.Marshal(duplicatePayload)
	require.NoError(t, err)
	duplicateReqBody := AddSubscriptionSourceRequest{
		Type:    "local",
		Payload: duplicateBytes,
	}
	duplicateReqBytes, err := json.Marshal(duplicateReqBody)
	require.NoError(t, err)

	duplicateReq := httptest.NewRequest("POST", "/sources", bytes.NewReader(duplicateReqBytes))
	duplicateW := httptest.NewRecorder()
	m.ServeHTTP(duplicateW, duplicateReq)

	assert.Equal(t, http.StatusConflict, duplicateW.Code)
	assert.Contains(t, duplicateW.Body.String(), "source name already exists: first-source")

	renamePayload := LocalSubscriptionSourcePayload{
		SubscriptionSourcePayload: SubscriptionSourcePayload{
			Name: "first-source",
		},
	}
	renameBytes, err := json.Marshal(renamePayload)
	require.NoError(t, err)
	renameReqBody := AddSubscriptionSourceRequest{
		Type:    "local",
		Payload: renameBytes,
	}
	renameReqBytes, err := json.Marshal(renameReqBody)
	require.NoError(t, err)

	renameReq := httptest.NewRequest("PATCH", "/sources/"+secondID, bytes.NewReader(renameReqBytes))
	renameW := httptest.NewRecorder()
	m.ServeHTTP(renameW, renameReq)

	assert.Equal(t, http.StatusConflict, renameW.Code)

	keepNameReq := httptest.NewRequest("PATCH", "/sources/"+firstID, bytes.NewReader(renameReqBytes))
	keepNameW := httptest.NewRecorder()
	m.ServeHTTP(keepNameW, keepNameReq)

	assert.Equal(t, http.StatusOK, keepNameW.Code)
}

func TestSinkNameConflicts(t *testing.T) {
	m, s, dbFile := setupTestMux(t)
	defer teardownTestMux(s, dbFile)

	firstID := addSinkForTest(t, m, "first-sink")
	secondID := addSinkForTest(t, m, "second-sink")

	duplicateReq := AddSubscriptionSinkRequest{
		Name:           "first-sink",
		SinkFormat:     substoreserver.SinkFormatJSON,
		PipelineScript: "*sources*",
	}
	duplicateBytes, err := json.Marshal(duplicateReq)
	require.NoError(t, err)

	duplicateHTTPReq := httptest.NewRequest("POST", "/sinks", bytes.NewReader(duplicateBytes))
	duplicateW := httptest.NewRecorder()
	m.ServeHTTP(duplicateW, duplicateHTTPReq)

	assert.Equal(t, http.StatusConflict, duplicateW.Code)
	assert.Contains(t, duplicateW.Body.String(), "sink name already exists: first-sink")

	renameReq := AddSubscriptionSinkRequest{
		Name:           "first-sink",
		SinkFormat:     substoreserver.SinkFormatJSON,
		PipelineScript: "*sources*",
	}
	renameBytes, err := json.Marshal(renameReq)
	require.NoError(t, err)

	renameHTTPReq := httptest.NewRequest("PATCH", "/sinks/"+secondID, bytes.NewReader(renameBytes))
	renameW := httptest.NewRecorder()
	m.ServeHTTP(renameW, renameHTTPReq)

	assert.Equal(t, http.StatusConflict, renameW.Code)

	keepNameHTTPReq := httptest.NewRequest("PATCH", "/sinks/"+firstID, bytes.NewReader(renameBytes))
	keepNameW := httptest.NewRecorder()
	m.ServeHTTP(keepNameW, keepNameHTTPReq)

	assert.Equal(t, http.StatusOK, keepNameW.Code)
}

func addLocalSourceForTest(t *testing.T, m *http.ServeMux, name string) string {
	t.Helper()

	payload := LocalSubscriptionSourcePayload{
		SubscriptionSourcePayload: SubscriptionSourcePayload{
			Name: name,
		},
		Content: "test-content",
	}
	payloadBytes, err := json.Marshal(payload)
	require.NoError(t, err)
	reqBody := AddSubscriptionSourceRequest{
		Type:    "local",
		Payload: payloadBytes,
	}
	reqBytes, err := json.Marshal(reqBody)
	require.NoError(t, err)

	req := httptest.NewRequest("POST", "/sources", bytes.NewReader(reqBytes))
	w := httptest.NewRecorder()
	m.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	var resp SourceResponse
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	return resp.ID
}

func addSinkForTest(t *testing.T, m *http.ServeMux, name string) string {
	t.Helper()

	reqBody := AddSubscriptionSinkRequest{
		Name:           name,
		SinkFormat:     substoreserver.SinkFormatJSON,
		PipelineScript: "*sources*",
	}
	reqBytes, err := json.Marshal(reqBody)
	require.NoError(t, err)

	req := httptest.NewRequest("POST", "/sinks", bytes.NewReader(reqBytes))
	w := httptest.NewRecorder()
	m.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	var resp SinkResponse
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	return resp.ID
}

func TestClientFetchTasks(t *testing.T) {
	m, s, dbFile := setupTestMux(t)
	defer teardownTestMux(s, dbFile)

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
	sReq := httptest.NewRequest("POST", "/sources", bytes.NewReader(sReqBytes))
	w := httptest.NewRecorder()
	m.ServeHTTP(w, sReq)

	var sourceResp SourceResponse
	json.Unmarshal(w.Body.Bytes(), &sourceResp)
	id := sourceResp.ID

	// Get tasks
	taskReq := httptest.NewRequest("GET", "/tasks", nil)
	w = httptest.NewRecorder()
	m.ServeHTTP(w, taskReq)
	assert.Equal(t, http.StatusOK, w.Code)
	assert.Contains(t, w.Body.String(), id)

	// Upload result
	uploadReq := httptest.NewRequest("POST", "/tasks/"+id+"/upload", bytes.NewReader([]byte("fetched-content")))
	w = httptest.NewRecorder()
	m.ServeHTTP(w, uploadReq)
	assert.Equal(t, http.StatusOK, w.Code)

	// Verify content in storage
	src, _ := s.GetSource(id)
	assert.Equal(t, "fetched-content", src.Content)
}

func TestEval(t *testing.T) {
	m, s, dbFile := setupTestMux(t)
	defer teardownTestMux(s, dbFile)

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
	sReq := httptest.NewRequest("POST", "/sources", bytes.NewReader(sReqBytes))
	wAdd := httptest.NewRecorder()
	m.ServeHTTP(wAdd, sReq)
	assert.Equal(t, http.StatusOK, wAdd.Code)

	evalReq := EvalRequest{
		Script: `(do (print "hello") (+ 1 (length *sources*)))`,
	}
	evalBytes, _ := json.Marshal(evalReq)
	req := httptest.NewRequest("POST", "/fennel/eval", bytes.NewReader(evalBytes))

	w := httptest.NewRecorder()
	m.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Eval failed with status %d: %s", w.Code, w.Body.String())
		return
	}

	var resp EvalResponse
	json.Unmarshal(w.Body.Bytes(), &resp)
	assert.Equal(t, float64(2), resp.Result) // 1 source + 1 = 2
	assert.Equal(t, "hello\n", resp.Stdout)
}

func TestConvertFennel(t *testing.T) {
	m, s, dbFile := setupTestMux(t)
	defer teardownTestMux(s, dbFile)

	t.Run("JSON", func(t *testing.T) {
		reqBody := ConvertFennelRequest{
			Content: `{"foo": "bar", "list": [1, 2, 3]}`,
		}
		reqBytes, _ := json.Marshal(reqBody)

		req := httptest.NewRequest("POST", "/fennel/convert", bytes.NewReader(reqBytes))
		w := httptest.NewRecorder()
		m.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)

		var resp ConvertFennelResponse
		json.Unmarshal(w.Body.Bytes(), &resp)
		assert.Contains(t, resp.Fennel, `:foo "bar"`)
		assert.Contains(t, resp.Fennel, `:list [1 2 3]`)
	})

	t.Run("YAML", func(t *testing.T) {
		reqBody := ConvertFennelRequest{
			Content: "foo: bar\nlist:\n  - 1\n  - 2\n  - 3",
		}
		reqBytes, _ := json.Marshal(reqBody)

		req := httptest.NewRequest("POST", "/fennel/convert", bytes.NewReader(reqBytes))
		w := httptest.NewRecorder()
		m.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)

		var resp ConvertFennelResponse
		json.Unmarshal(w.Body.Bytes(), &resp)
		assert.Contains(t, resp.Fennel, `:foo "bar"`)
		assert.Contains(t, resp.Fennel, `:list [1 2 3]`)
	})
}
