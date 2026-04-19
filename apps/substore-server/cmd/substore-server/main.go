package main

import (
	"context"
	"io"
	"io/fs"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	substoreserver "github.com/jvj-wonderland/substore/server"
	"github.com/jvj-wonderland/substore/server/internal/fennel"
	"github.com/jvj-wonderland/substore/server/internal/storage"
	"github.com/jvj-wonderland/substore/server/mux"
)

type App struct {
	storage *storage.Storage
	fennel  *fennel.Pool
}

func NewApp(dbPath string) (*App, error) {
	s, err := storage.NewStorage(dbPath)
	if err != nil {
		return nil, err
	}
	return &App{
		storage: s,
		fennel:  fennel.NewPool(),
	}, nil
}

func getEnv(key, fallback string) string {
	if value, ok := os.LookupEnv(key); ok {
		return value
	}
	return fallback
}

func getDBPath() string {
	path := os.Getenv("SUBSTORE_DB_PATH")
	if path != "" {
		return path
	}
	// Fallback for Linux
	home, err := os.UserHomeDir()
	if err == nil {
		// Use ~/.local/share/substore/substore.db as a safe default on Linux
		defaultDir := filepath.Join(home, ".local", "share", "substore")
		_ = os.MkdirAll(defaultDir, 0755)
		return filepath.Join(defaultDir, "substore.db")
	}
	return "substore.db"
}

func main() {
	dbPath := getDBPath()
	log.Printf("Using database at %s", dbPath)
	app, err := NewApp(dbPath)
	if err != nil {
		log.Fatal(err)
	}
	defer app.storage.Close()

	go app.startBackgroundFetcher(context.Background())

	// Admin API
	apiMux := mux.NewAdminMux(app.storage, app.fennel)

	// Combined Mux for Admin Port
	adminMux := http.NewServeMux()
	adminMux.Handle("/api/", http.StripPrefix("/api", apiMux))

	// Serve SPA
	uiFS, err := fs.Sub(substoreserver.UIDist, "dist")
	if err != nil {
		log.Fatal(err)
	}
	fileServer := http.FileServer(http.FS(uiFS))

	adminMux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		// If it's an API call, it should have been caught by /api/ prefix
		if strings.HasPrefix(r.URL.Path, "/api") {
			http.NotFound(w, r)
			return
		}

		// Check if file exists in embedded FS
		f, err := uiFS.Open(strings.TrimPrefix(r.URL.Path, "/"))
		if err == nil {
			f.Close()
			fileServer.ServeHTTP(w, r)
			return
		}

		// Fallback to index.html for SPA routing
		index, err := substoreserver.UIDist.ReadFile("dist/index.html")
		if err != nil {
			http.Error(w, "SPA not found", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Write(index)
	})

	// Execution API
	execMux := mux.NewExecMux(app.storage, app.fennel)

	adminPort := getEnv("SUBSTORE_ADMIN_PORT", "8080")
	executionPort := getEnv("SUBSTORE_EXECUTION_PORT", "8001")

	go func() {
		log.Printf("Admin API and SPA starting on :%s", adminPort)
		if err := http.ListenAndServe(":"+adminPort, adminMux); err != nil {
			log.Fatalf("Admin API failed: %v", err)
		}
	}()

	log.Printf("Execution API starting on :%s", executionPort)
	if err := http.ListenAndServe(":"+executionPort, execMux); err != nil {
		log.Fatalf("Execution API failed: %v", err)
	}
}

func (a *App) startBackgroundFetcher(ctx context.Context) {
	ticker := time.NewTicker(1 * time.Minute)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			a.fetchServerSources()
		}
	}
}

func (a *App) fetchServerSources() {
	sources, err := a.storage.GetAllSources()
	if err != nil {
		log.Printf("failed to get sources: %v", err)
		return
	}

	now := time.Now().Unix()
	for _, src := range sources {
		if src.Type == "remote" && src.FetchMode == substoreserver.FetchModeServer {
			if src.LastUpdated == 0 || now > src.LastUpdated+src.UpdateInterval {
				go a.fetchSource(src)
			}
		}
	}
}

func (a *App) fetchSource(src *storage.Source) {
	log.Printf("fetching source %s from %s", src.Name, src.URL)
	resp, err := http.Get(src.URL)
	if err != nil {
		log.Printf("failed to fetch %s: %v", src.URL, err)
		return
	}
	defer resp.Body.Close()

	content, err := io.ReadAll(resp.Body)
	if err != nil {
		log.Printf("failed to read body of %s: %v", src.URL, err)
		return
	}

	src.Content = string(content)
	src.LastUpdated = time.Now().Unix()

	if err := a.storage.AddSource(src); err != nil {
		log.Printf("failed to update source %s: %v", src.Name, err)
	}
}
