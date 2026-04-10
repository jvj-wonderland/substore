package substoreserver

import (
	"encoding/json"
	"fmt"
)

type FetchMode int

const (
	FetchModeServer FetchMode = iota
	FetchModeBrowser
)

func (fm FetchMode) String() string {
	switch fm {
	case FetchModeServer:
		return "server"
	case FetchModeBrowser:
		return "browser"
	default:
		return "unknown"
	}
}

func (fm *FetchMode) UnmarshalJSON(b []byte) error {
	var s string
	if err := json.Unmarshal(b, &s); err != nil {
		return err
	}
	switch s {
	case "server":
		*fm = FetchModeServer
	case "browser":
		*fm = FetchModeBrowser
	default:
		return fmt.Errorf("invalid fetch mode: %s", s)
	}
	return nil
}

func (fm FetchMode) MarshalJSON() ([]byte, error) {
	return json.Marshal(fm.String())
}

type SinkFormat int

const (
	SinkFormatJSON SinkFormat = iota
	SinkFormatYAML
)

func (sf SinkFormat) String() string {
	switch sf {
	case SinkFormatJSON:
		return "json"
	case SinkFormatYAML:
		return "yaml"
	default:
		return "unknown"
	}
}

func (sf *SinkFormat) UnmarshalJSON(b []byte) error {
	var s string
	if err := json.Unmarshal(b, &s); err != nil {
		return err
	}
	switch s {
	case "json":
		*sf = SinkFormatJSON
	case "yaml":
		*sf = SinkFormatYAML
	default:
		return fmt.Errorf("invalid sink format: %s", s)
	}
	return nil
}

func (sf SinkFormat) MarshalJSON() ([]byte, error) {
	return json.Marshal(sf.String())
}

type SubscriptionSource struct {
	ID   string
	Name string
	Tags []string
}

type RemoteSubscriptionSource struct {
	SubscriptionSource
	URL            string
	FetchMode      FetchMode
	UpdateInterval int64
	LastUpdated    int64
	Content        *string
}

type LocalSubscriptionSource struct {
	SubscriptionSource
	Content string
}

type SubscriptionSink struct {
	Name                   string
	SinkFormat             SinkFormat
	PipelineScript         string
	CompiledPipelineScript string
}
