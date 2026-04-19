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
