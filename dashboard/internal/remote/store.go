package remote

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"sync"
	"time"
)

// AgentToken represents a registered agent with its authentication token.
type AgentToken struct {
	ID        string    `json:"id"`
	Token     string    `json:"token"`
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"created_at"`
	LastSeen  time.Time `json:"last_seen,omitempty"`
	Revoked   bool      `json:"revoked,omitempty"`
}

// Store manages agent tokens with JSON file persistence.
// All public methods are thread-safe via sync.RWMutex.
type Store struct {
	mu     sync.RWMutex
	path   string
	tokens []AgentToken
}

// NewStore creates a new token store and loads existing data from disk.
// If the file does not exist, the store starts with an empty token list.
func NewStore(path string) *Store {
	s := &Store{
		path: path,
	}
	if err := s.Load(); err != nil {
		// Log but don't fail — start with empty list
		fmt.Fprintf(os.Stderr, "[Remote Store] Failed to load %s: %v\n", path, err)
	}
	return s
}

// Load reads tokens from the JSON file on disk.
// Returns nil if the file does not exist (empty store).
func (s *Store) Load() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	data, err := os.ReadFile(s.path)
	if os.IsNotExist(err) {
		s.tokens = nil
		return nil
	}
	if err != nil {
		return fmt.Errorf("read agents file: %w", err)
	}
	return json.Unmarshal(data, &s.tokens)
}

// Save writes the current token list to disk with 0600 permissions.
// Caller must hold the write lock (mu).
func (s *Store) save() error {
	data, err := json.MarshalIndent(s.tokens, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal tokens: %w", err)
	}
	return os.WriteFile(s.path, data, 0600)
}

// GenerateToken produces a cryptographically random 64-character hex string
// (256 bits of entropy) suitable for agent authentication.
func GenerateToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", fmt.Errorf("generate token: %w", err)
	}
	return hex.EncodeToString(b), nil
}

// generateID produces an 8-character hex ID for agent references.
func generateID() (string, error) {
	b := make([]byte, 4)
	if _, err := rand.Read(b); err != nil {
		return "", fmt.Errorf("generate id: %w", err)
	}
	return hex.EncodeToString(b), nil
}

// Create generates a new agent token with the given name.
// Returns the full AgentToken (including unmasked token) for one-time display to user.
func (s *Store) Create(name string) (*AgentToken, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	token, err := GenerateToken()
	if err != nil {
		return nil, err
	}

	id, err := generateID()
	if err != nil {
		return nil, err
	}

	at := AgentToken{
		ID:        id,
		Token:     token,
		Name:      name,
		CreatedAt: time.Now().UTC(),
	}

	s.tokens = append(s.tokens, at)
	if err := s.save(); err != nil {
		// Roll back in-memory change on save failure
		s.tokens = s.tokens[:len(s.tokens)-1]
		return nil, fmt.Errorf("save after create: %w", err)
	}

	return &at, nil
}

// List returns all tokens with the Token field masked (first 8 chars + "...").
// Returns a copy to prevent mutation of internal state.
func (s *Store) List() []AgentToken {
	s.mu.RLock()
	defer s.mu.RUnlock()

	result := make([]AgentToken, len(s.tokens))
	for i, t := range s.tokens {
		result[i] = t
		if len(t.Token) > 8 {
			result[i].Token = t.Token[:8] + "..."
		}
	}
	return result
}

// Get returns a token by its ID, or nil if not found.
// The returned token has the full unmasked Token field.
func (s *Store) Get(id string) *AgentToken {
	s.mu.RLock()
	defer s.mu.RUnlock()

	for i := range s.tokens {
		if s.tokens[i].ID == id {
			t := s.tokens[i]
			return &t
		}
	}
	return nil
}

// Revoke marks a token as revoked so it can no longer be used for authentication.
func (s *Store) Revoke(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	for i := range s.tokens {
		if s.tokens[i].ID == id {
			s.tokens[i].Revoked = true
			return s.save()
		}
	}
	return fmt.Errorf("token %s not found", id)
}

// Delete permanently removes a token from the store.
func (s *Store) Delete(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	for i := range s.tokens {
		if s.tokens[i].ID == id {
			s.tokens = append(s.tokens[:i], s.tokens[i+1:]...)
			return s.save()
		}
	}
	return fmt.Errorf("token %s not found", id)
}

// ValidateToken checks a raw token string against all non-revoked entries.
// Returns the agent ID and true if valid, or empty string and false otherwise.
func (s *Store) ValidateToken(token string) (string, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	for _, t := range s.tokens {
		if !t.Revoked && t.Token == token {
			return t.ID, true
		}
	}
	return "", false
}

// UpdateLastSeen updates the LastSeen timestamp for the given agent ID.
// Called on each heartbeat from the agent.
func (s *Store) UpdateLastSeen(id string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	for i := range s.tokens {
		if s.tokens[i].ID == id {
			s.tokens[i].LastSeen = time.Now().UTC()
			// Best-effort save — don't block heartbeat on disk I/O failure
			_ = s.save()
			return
		}
	}
}
