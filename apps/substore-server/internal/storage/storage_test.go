package storage

import (
	"os"
	"testing"

	substoreserver "github.com/jvj-wonderland/substore/server"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setupTestDB(t *testing.T) (*Storage, string) {
	tmpfile, err := os.CreateTemp("", "substore-test-*.db")
	require.NoError(t, err)
	tmpfile.Close()
	path := tmpfile.Name()

	s, err := NewStorage(path)
	require.NoError(t, err)
	return s, path
}

func teardownTestDB(s *Storage, path string) {
	s.Close()
	os.Remove(path)
}

func TestSourceStorage(t *testing.T) {
	s, path := setupTestDB(t)
	defer teardownTestDB(s, path)

	source := &Source{
		ID:      "test-id",
		Name:    "test-source",
		Type:    "local",
		Content: "some content",
	}

	err := s.AddSource(source)
	assert.NoError(t, err)

	got, err := s.GetSource("test-id")
	assert.NoError(t, err)
	assert.Equal(t, source.Name, got.Name)
	assert.Equal(t, source.Content, got.Content)

	sources, err := s.GetAllSources()
	assert.NoError(t, err)
	assert.Len(t, sources, 1)
	assert.Equal(t, "test-id", sources[0].ID)
}

func TestSinkStorage(t *testing.T) {
	s, path := setupTestDB(t)
	defer teardownTestDB(s, path)

	sink := &substoreserver.SubscriptionSink{
		Name:           "mysink",
		SinkFormat:     substoreserver.SinkFormatJSON,
		PipelineScript: "script",
	}

	err := s.AddSink(sink)
	assert.NoError(t, err)

	got, err := s.GetSink("mysink")
	assert.NoError(t, err)
	assert.Equal(t, sink.SinkFormat, got.SinkFormat)
	assert.Equal(t, sink.PipelineScript, got.PipelineScript)

	sinks, err := s.GetAllSinks()
	assert.NoError(t, err)
	assert.Len(t, sinks, 1)
	assert.Equal(t, "mysink", sinks[0].Name)
}
