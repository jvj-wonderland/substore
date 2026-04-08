package substoreserver

import "fmt"

type FetchMode int

const (
	FetchModeServer FetchMode = iota
	FetchModeBrowser
)

type SinkFormat int

const (
	SinkFormatJSON SinkFormat = iota
	SinkFormatYAML
)

func (fm FetchMode) String() string {
	switch fm {
	case FetchModeServer:
		return "server"
	case FetchModeBrowser:
		return "browser"
	default:
		panic(fmt.Errorf("invalid FetchMode: %d", fm))
	}
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
	Name           string
	SinkFormat     SinkFormat
	PipelineScript string
}
