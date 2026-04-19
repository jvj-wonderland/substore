package substoreserver

import "embed"

// UIDist contains the embedded static files for the SPA.
//
//go:embed all:dist
var UIDist embed.FS
