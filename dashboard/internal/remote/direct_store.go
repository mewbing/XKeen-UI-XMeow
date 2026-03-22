package remote

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"sync"
	"time"
)

// DirectAgent represents a remote router connected directly by IP:port
// (without SSH reverse tunnel). The primary target is mihomo's external-controller
// (MihomoPort, default 9090). Optionally, if xmeow-server is running on the remote
// router, ServerPort can be set to enable advanced features (logs, terminal, config editor).
type DirectAgent struct {
	ID         string    `json:"id"`
	Name       string    `json:"name"`
	Host       string    `json:"host"`
	MihomoPort int       `json:"mihomo_port"`           // mihomo external-controller port (default 9090)
	OldPort    int       `json:"port,omitempty"`         // deprecated: old field for backward compat migration
	ServerPort int       `json:"server_port,omitempty"`  // xmeow-server port (0 = not available)
	Secret     string    `json:"secret,omitempty"`       // mihomo secret for Authorization
	CreatedAt  time.Time `json:"created_at"`
}

// DirectStore manages direct agent connections with JSON file persistence.
// All public methods are thread-safe via sync.RWMutex.
type DirectStore struct {
	mu     sync.RWMutex
	path   string
	agents []DirectAgent
}

// NewDirectStore creates a store and loads existing data from disk.
func NewDirectStore(path string) *DirectStore {
	s := &DirectStore{path: path}
	if err := s.load(); err != nil {
		fmt.Fprintf(os.Stderr, "[Direct Store] Failed to load %s: %v\n", path, err)
	}
	return s
}

func (s *DirectStore) load() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	data, err := os.ReadFile(s.path)
	if os.IsNotExist(err) {
		s.agents = nil
		return nil
	}
	if err != nil {
		return fmt.Errorf("read direct agents file: %w", err)
	}
	if err := json.Unmarshal(data, &s.agents); err != nil {
		return err
	}

	// Migrate old format: "port" → "mihomo_port"
	needSave := false
	for i := range s.agents {
		if s.agents[i].MihomoPort == 0 && s.agents[i].OldPort > 0 {
			log.Printf("[Direct Store] Migrating agent %s: port %d → mihomo_port", s.agents[i].Name, s.agents[i].OldPort)
			s.agents[i].MihomoPort = s.agents[i].OldPort
			s.agents[i].OldPort = 0
			needSave = true
		}
		// Ensure MihomoPort always has a valid default
		if s.agents[i].MihomoPort == 0 {
			s.agents[i].MihomoPort = 9090
			needSave = true
		}
	}
	if needSave {
		_ = s.save()
	}
	return nil
}

func (s *DirectStore) save() error {
	data, err := json.MarshalIndent(s.agents, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal direct agents: %w", err)
	}
	return os.WriteFile(s.path, data, 0600)
}

// Add creates a new direct agent connection.
func (s *DirectStore) Add(name, host string, mihomoPort, serverPort int, secret string) (*DirectAgent, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	id, err := generateID()
	if err != nil {
		return nil, err
	}

	agent := DirectAgent{
		ID:         id,
		Name:       name,
		Host:       host,
		MihomoPort: mihomoPort,
		ServerPort: serverPort,
		Secret:     secret,
		CreatedAt:  time.Now().UTC(),
	}

	s.agents = append(s.agents, agent)
	if err := s.save(); err != nil {
		s.agents = s.agents[:len(s.agents)-1]
		return nil, fmt.Errorf("save after add: %w", err)
	}

	return &agent, nil
}

// List returns all direct agents with Secret masked.
func (s *DirectStore) List() []DirectAgent {
	s.mu.RLock()
	defer s.mu.RUnlock()

	result := make([]DirectAgent, len(s.agents))
	for i, a := range s.agents {
		result[i] = a
		result[i].OldPort = 0 // never expose deprecated field
		if len(a.Secret) > 8 {
			result[i].Secret = a.Secret[:8] + "..."
		} else if a.Secret != "" {
			result[i].Secret = "***"
		}
	}
	return result
}

// Get returns a direct agent by ID with the FULL (unmasked) secret.
func (s *DirectStore) Get(id string) *DirectAgent {
	s.mu.RLock()
	defer s.mu.RUnlock()

	for i := range s.agents {
		if s.agents[i].ID == id {
			a := s.agents[i]
			return &a
		}
	}
	return nil
}

// UpdateServerPort sets the ServerPort for an agent (used by auto-detection).
// Returns true if the value actually changed.
func (s *DirectStore) UpdateServerPort(id string, port int) bool {
	s.mu.Lock()
	defer s.mu.Unlock()

	for i := range s.agents {
		if s.agents[i].ID == id {
			if s.agents[i].ServerPort == port {
				return false
			}
			s.agents[i].ServerPort = port
			_ = s.save()
			return true
		}
	}
	return false
}

// Delete removes a direct agent by ID.
func (s *DirectStore) Delete(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	for i := range s.agents {
		if s.agents[i].ID == id {
			s.agents = append(s.agents[:i], s.agents[i+1:]...)
			return s.save()
		}
	}
	return fmt.Errorf("direct agent %s not found", id)
}
