package terminal

import (
	"fmt"
	"io"
	"sync"
	"time"

	"golang.org/x/crypto/ssh"
)

// Session represents an SSH client connection with PTY.
// It manages the SSH client lifecycle, stdin/stdout pipes, and PTY resize.
type Session struct {
	mu        sync.Mutex
	client    *ssh.Client
	session   *ssh.Session
	stdin     io.WriteCloser
	stdout    io.Reader
	lastInput time.Time
	done      chan struct{}
	closed    bool
}

// NewSession creates a new terminal session (not yet connected).
func NewSession() *Session {
	return &Session{
		done: make(chan struct{}),
	}
}

// Connect establishes an SSH connection to the specified host and starts
// an interactive shell with a PTY of the given size.
func (s *Session) Connect(host string, port int, user, password string, cols, rows int) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.closed {
		return fmt.Errorf("session is closed")
	}

	cfg := &ssh.ClientConfig{
		User: user,
		Auth: []ssh.AuthMethod{
			ssh.Password(password),
		},
		// InsecureIgnoreHostKey is acceptable here: this connects to a home router
		// on the local network (typically localhost or LAN IP).
		HostKeyCallback: ssh.InsecureIgnoreHostKey(),
		Timeout:         10 * time.Second,
	}

	addr := fmt.Sprintf("%s:%d", host, port)
	client, err := ssh.Dial("tcp", addr, cfg)
	if err != nil {
		return fmt.Errorf("ssh dial: %w", err)
	}

	session, err := client.NewSession()
	if err != nil {
		client.Close()
		return fmt.Errorf("new session: %w", err)
	}

	// Request a PTY with xterm-256color terminal type
	modes := ssh.TerminalModes{
		ssh.ECHO:          1,
		ssh.TTY_OP_ISPEED: 14400,
		ssh.TTY_OP_OSPEED: 14400,
	}
	if err := session.RequestPty("xterm-256color", rows, cols, modes); err != nil {
		session.Close()
		client.Close()
		return fmt.Errorf("request pty: %w", err)
	}

	stdin, err := session.StdinPipe()
	if err != nil {
		session.Close()
		client.Close()
		return fmt.Errorf("stdin pipe: %w", err)
	}

	stdout, err := session.StdoutPipe()
	if err != nil {
		session.Close()
		client.Close()
		return fmt.Errorf("stdout pipe: %w", err)
	}

	// Start user's default login shell (from /etc/passwd)
	if err := session.Shell(); err != nil {
		session.Close()
		client.Close()
		return fmt.Errorf("start shell: %w", err)
	}

	s.client = client
	s.session = session
	s.stdin = stdin
	s.stdout = stdout
	s.lastInput = time.Now()

	// Monitor session exit in background
	go func() {
		_ = session.Wait()
		s.Close()
	}()

	return nil
}

// Write sends data to the SSH session's stdin and updates the last input timestamp.
func (s *Session) Write(data []byte) (int, error) {
	s.mu.Lock()
	stdin := s.stdin
	if s.closed || stdin == nil {
		s.mu.Unlock()
		return 0, fmt.Errorf("session closed")
	}
	s.lastInput = time.Now()
	s.mu.Unlock()

	return stdin.Write(data)
}

// Read reads data from the SSH session's stdout. Blocks until data is available.
func (s *Session) Read(buf []byte) (int, error) {
	s.mu.Lock()
	stdout := s.stdout
	if s.closed || stdout == nil {
		s.mu.Unlock()
		return 0, fmt.Errorf("session closed")
	}
	s.mu.Unlock()

	return stdout.Read(buf)
}

// Resize changes the PTY window size. Note: WindowChange takes (rows, cols).
func (s *Session) Resize(cols, rows int) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.closed || s.session == nil {
		return fmt.Errorf("session closed")
	}
	return s.session.WindowChange(rows, cols)
}

// Close idempotently closes the SSH session and client.
func (s *Session) Close() {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.closed {
		return
	}
	s.closed = true

	if s.stdin != nil {
		s.stdin.Close()
	}
	if s.session != nil {
		s.session.Close()
	}
	if s.client != nil {
		s.client.Close()
	}

	close(s.done)
}

// Alive returns true if the session is still open.
func (s *Session) Alive() bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	return !s.closed
}

// LastInput returns the timestamp of the last user input.
func (s *Session) LastInput() time.Time {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.lastInput
}

// Done returns a channel that is closed when the session ends.
func (s *Session) Done() <-chan struct{} {
	return s.done
}
