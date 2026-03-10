package terminal

import (
	"fmt"
	"os"
	"os/exec"
	"sync"
	"time"

	"github.com/creack/pty/v2"
)

// AllowedCommands maps user-facing command strings to exec args.
var AllowedCommands = map[string][]string{
	"xkeen -uk":    {"xkeen", "-uk"},
	"xkeen -i":     {"xkeen", "-i"},
	"xkeen -ik":    {"xkeen", "-ik"},
	"xkeen -stop":  {"xkeen", "-stop"},
	"xkeen -start": {"xkeen", "-start"},
}

// ExecSession runs a local command with a PTY.
type ExecSession struct {
	mu        sync.Mutex
	cmd       *exec.Cmd
	ptmx      *os.File
	lastInput time.Time
	done      chan struct{}
	closed    bool
}

// Compile-time check: ExecSession implements TerminalSession.
var _ TerminalSession = (*ExecSession)(nil)

// NewExecSession creates a new exec session (not yet started).
func NewExecSession() *ExecSession {
	return &ExecSession{
		done: make(chan struct{}),
	}
}

// Start launches the command with a PTY of the given size.
// The command string is validated against AllowedCommands whitelist.
func (s *ExecSession) Start(command string, cols, rows int) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.closed {
		return fmt.Errorf("session is closed")
	}

	parts, ok := AllowedCommands[command]
	if !ok {
		return fmt.Errorf("command not allowed: %s", command)
	}

	cmd := exec.Command(parts[0], parts[1:]...)
	cmd.Env = os.Environ()

	winSize := &pty.Winsize{
		Rows: uint16(rows),
		Cols: uint16(cols),
	}

	ptmx, err := pty.StartWithSize(cmd, winSize)
	if err != nil {
		return fmt.Errorf("pty start: %w", err)
	}

	s.cmd = cmd
	s.ptmx = ptmx
	s.lastInput = time.Now()

	// Monitor process exit
	go func() {
		_ = cmd.Wait()
		s.Close()
	}()

	return nil
}

// Write sends data to the PTY stdin.
func (s *ExecSession) Write(data []byte) (int, error) {
	s.mu.Lock()
	ptmx := s.ptmx
	if s.closed || ptmx == nil {
		s.mu.Unlock()
		return 0, fmt.Errorf("session closed")
	}
	s.lastInput = time.Now()
	s.mu.Unlock()

	return ptmx.Write(data)
}

// Read reads data from the PTY stdout. Blocks until data is available.
func (s *ExecSession) Read(buf []byte) (int, error) {
	s.mu.Lock()
	ptmx := s.ptmx
	if s.closed || ptmx == nil {
		s.mu.Unlock()
		return 0, fmt.Errorf("session closed")
	}
	s.mu.Unlock()

	return ptmx.Read(buf)
}

// Resize changes the PTY window size.
func (s *ExecSession) Resize(cols, rows int) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.closed || s.ptmx == nil {
		return fmt.Errorf("session closed")
	}
	return pty.Setsize(s.ptmx, &pty.Winsize{
		Rows: uint16(rows),
		Cols: uint16(cols),
	})
}

// Close idempotently closes the PTY and kills the process.
func (s *ExecSession) Close() {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.closed {
		return
	}
	s.closed = true

	if s.ptmx != nil {
		s.ptmx.Close()
	}
	if s.cmd != nil && s.cmd.Process != nil {
		_ = s.cmd.Process.Kill()
	}

	close(s.done)
}

// Alive returns true if the session is still open.
func (s *ExecSession) Alive() bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	return !s.closed
}

// LastInput returns the timestamp of the last user input.
func (s *ExecSession) LastInput() time.Time {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.lastInput
}

// Done returns a channel that is closed when the session ends.
func (s *ExecSession) Done() <-chan struct{} {
	return s.done
}
