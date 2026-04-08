package main

import (
	"encoding/json"
	"net/http"

	substoreserver "github.com/jvj-wonderland/substore/server"
)

func main() {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /", func(w http.ResponseWriter, r *http.Request) {

	})

	apiMux := http.NewServeMux()
	apiMux.HandleFunc("POST /sources", func(w http.ResponseWriter, r *http.Request) {
	})

	apiMux.HandleFunc("GET /sources", func(w http.ResponseWriter, r *http.Request) {

	})

	mux.Handle("/api/", http.StripPrefix("/api", apiMux))

	http.ListenAndServe(":8080", mux)
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
