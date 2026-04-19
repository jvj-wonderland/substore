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

func setupTestExecMux(t *testing.T) (*http.ServeMux, *http.ServeMux, *storage.Storage, string) {
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
	adminMux := NewAdminMux(s, pool)
	execMux := NewExecMux(s, pool)
	return adminMux, execMux, s, dbFile
}

func TestAddSinkAndExecute(t *testing.T) {
	adminMux, execMux, s, dbFile := setupTestExecMux(t)
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
	adminMux.ServeHTTP(wAdd, sReq)
	assert.Equal(t, http.StatusOK, wAdd.Code, "Adding source failed: "+wAdd.Body.String())

	// Add a sink
	sinkReq := AddSubscriptionSinkRequest{
		Name:           "mysink",
		SinkFormat:     substoreserver.SinkFormatJSON,
		PipelineScript: `*sources*`,
	}
	sinkBytes, _ := json.Marshal(sinkReq)
	req := httptest.NewRequest("POST", "/sinks", bytes.NewReader(sinkBytes))
	wSink := httptest.NewRecorder()
	adminMux.ServeHTTP(wSink, req)
	assert.Equal(t, http.StatusOK, wSink.Code, "Adding sink failed: "+wSink.Body.String())

	var sinkResp SinkResponse
	json.Unmarshal(wSink.Body.Bytes(), &sinkResp)
	assert.NotEmpty(t, sinkResp.Secret)

	// Update sink
	sinkUpdateReq := AddSubscriptionSinkRequest{
		SinkFormat: substoreserver.SinkFormatYAML,
	}
	sinkUpBytes, _ := json.Marshal(sinkUpdateReq)
	upReq := httptest.NewRequest("PATCH", "/sinks/mysink", bytes.NewReader(sinkUpBytes))
	upW := httptest.NewRecorder()
	adminMux.ServeHTTP(upW, upReq)
	assert.Equal(t, http.StatusOK, upW.Code)

	var upResp SinkResponse
	json.Unmarshal(upW.Body.Bytes(), &upResp)
	assert.Equal(t, sinkResp.Secret, upResp.Secret, "Secret should be preserved on update")

	// Regenerate sink secret
	regenReq := httptest.NewRequest("POST", "/sinks/mysink/secret", nil)
	regenW := httptest.NewRecorder()
	adminMux.ServeHTTP(regenW, regenReq)
	assert.Equal(t, http.StatusOK, regenW.Code)

	var regenResp SinkResponse
	json.Unmarshal(regenW.Body.Bytes(), &regenResp)
	assert.NotEqual(t, sinkResp.Secret, regenResp.Secret)

	// Execute sink without secret - should fail
	execReqNoSecret := httptest.NewRequest("GET", "/mysink", nil)
	wExecNoSecret := httptest.NewRecorder()
	execMux.ServeHTTP(wExecNoSecret, execReqNoSecret)
	assert.Equal(t, http.StatusUnauthorized, wExecNoSecret.Code)

	// Execute sink with correct secret
	execReq := httptest.NewRequest("GET", "/mysink", nil)
	execReq.SetBasicAuth("substore", regenResp.Secret)
	wExec := httptest.NewRecorder()
	execMux.ServeHTTP(wExec, execReq)

	assert.Equal(t, http.StatusOK, wExec.Code, "Executing sink failed: "+wExec.Body.String())
	assert.Contains(t, wExec.Body.String(), "foo: bar") // YAML output now
}
