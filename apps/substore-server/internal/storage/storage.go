package storage

import (
	"bytes"
	"encoding/gob"
	"fmt"

	substoreserver "github.com/jvj-wonderland/substore/server"
	"go.etcd.io/bbolt"
)

type Source struct {
	ID             string
	Name           string
	Tags           []string
	Type           string // "local", "remote"
	URL            string // for remote
	FetchMode      substoreserver.FetchMode // for remote
	UpdateInterval int64 // for remote
	LastUpdated    int64 // for remote
	Content        string
}

type Storage struct {
	db *bbolt.DB
}

var (
	bucketSources = []byte("sources")
	bucketSinks   = []byte("sinks")
)

func NewStorage(path string) (*Storage, error) {
	db, err := bbolt.Open(path, 0600, nil)
	if err != nil {
		return nil, err
	}

	err = db.Update(func(tx *bbolt.Tx) error {
		_, err := tx.CreateBucketIfNotExists(bucketSources)
		if err != nil {
			return err
		}
		_, err = tx.CreateBucketIfNotExists(bucketSinks)
		return err
	})
	if err != nil {
		return nil, err
	}

	return &Storage{db: db}, nil
}

func (s *Storage) Close() error {
	return s.db.Close()
}

func (s *Storage) AddSource(source *Source) error {
	return s.db.Update(func(tx *bbolt.Tx) error {
		b := tx.Bucket(bucketSources)
		var buf bytes.Buffer
		if err := gob.NewEncoder(&buf).Encode(source); err != nil {
			return err
		}
		return b.Put([]byte(source.ID), buf.Bytes())
	})
}

func (s *Storage) GetSource(id string) (*Source, error) {
	var source Source
	err := s.db.View(func(tx *bbolt.Tx) error {
		b := tx.Bucket(bucketSources)
		v := b.Get([]byte(id))
		if v == nil {
			return fmt.Errorf("source not found: %s", id)
		}
		return gob.NewDecoder(bytes.NewReader(v)).Decode(&source)
	})
	if err != nil {
		return nil, err
	}
	return &source, nil
}

func (s *Storage) GetAllSources() ([]*Source, error) {
	var sources []*Source
	err := s.db.View(func(tx *bbolt.Tx) error {
		b := tx.Bucket(bucketSources)
		return b.ForEach(func(k, v []byte) error {
			var source Source
			if err := gob.NewDecoder(bytes.NewReader(v)).Decode(&source); err != nil {
				return err
			}
			sources = append(sources, &source)
			return nil
		})
	})
	if err != nil {
		return nil, err
	}
	return sources, nil
}

func (s *Storage) AddSink(sink *substoreserver.SubscriptionSink) error {
	return s.db.Update(func(tx *bbolt.Tx) error {
		b := tx.Bucket(bucketSinks)
		var buf bytes.Buffer
		if err := gob.NewEncoder(&buf).Encode(sink); err != nil {
			return err
		}
		return b.Put([]byte(sink.Name), buf.Bytes())
	})
}

func (s *Storage) GetSink(name string) (*substoreserver.SubscriptionSink, error) {
	var sink substoreserver.SubscriptionSink
	err := s.db.View(func(tx *bbolt.Tx) error {
		b := tx.Bucket(bucketSinks)
		v := b.Get([]byte(name))
		if v == nil {
			return fmt.Errorf("sink not found: %s", name)
		}
		return gob.NewDecoder(bytes.NewReader(v)).Decode(&sink)
	})
	if err != nil {
		return nil, err
	}
	return &sink, nil
}

func (s *Storage) GetAllSinks() ([]*substoreserver.SubscriptionSink, error) {
	var sinks []*substoreserver.SubscriptionSink
	err := s.db.View(func(tx *bbolt.Tx) error {
		b := tx.Bucket(bucketSinks)
		return b.ForEach(func(k, v []byte) error {
			var sink substoreserver.SubscriptionSink
			if err := gob.NewDecoder(bytes.NewReader(v)).Decode(&sink); err != nil {
				return err
			}
			sinks = append(sinks, &sink)
			return nil
		})
	})
	if err != nil {
		return nil, err
	}
	return sinks, nil
}
