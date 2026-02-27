---
status: diagnosed
trigger: "xkeen running but doesn't show green dot, Start button doesn't work"
created: 2026-02-27T12:00:00Z
updated: 2026-02-27T12:30:00Z
---

## Current Focus

hypothesis: Two independent root causes - status checks wrong process, Start button disabled by stale state
test: Code trace analysis complete
expecting: N/A
next_action: Report diagnosis

## Symptoms

expected: Green dot when xkeen is running; clicking Start should launch service
actual: Always red dot; Start button does nothing visible
errors: None reported (silent failures)
reproduction: Open dashboard when xkeen is running - badge shows red
started: Since implementation

## Eliminated

(none - root causes found on first pass)

## Evidence

- timestamp: 2026-02-27T12:05:00Z
  checked: backend/server.py line 90-104 - service_status endpoint
  found: Uses `pidof mihomo` to check status, but service is called `xkeen`
  implication: ROOT CAUSE 1 - checking wrong process name

- timestamp: 2026-02-27T12:10:00Z
  checked: backend/server.py line 66-87 - service_action endpoint
  found: Uses XKEEN_INIT (/opt/etc/init.d/S24xray) for start/stop - this is correct
  implication: Backend start command itself is correct, issue is elsewhere

- timestamp: 2026-02-27T12:12:00Z
  checked: src/lib/config-api.ts line 34-42 - fetchServiceStatus
  found: No error handling for non-ok responses; returns res.json() directly
  implication: If fetch fails silently, status defaults to running=false

- timestamp: 2026-02-27T12:15:00Z
  checked: src/hooks/use-service-status.ts line 27-38
  found: On error, keeps last known running state (which starts as false)
  implication: If API unreachable, status stays false forever

- timestamp: 2026-02-27T12:18:00Z
  checked: src/components/overview/ServiceControl.tsx line 119-121
  found: Start button has `disabled={running || isProcessing}`
  implication: If running=false (correct for broken status), Start should be ENABLED, not disabled

- timestamp: 2026-02-27T12:20:00Z
  checked: src/components/overview/ServiceControl.tsx line 56-68 - handleAction
  found: Calls serviceAction(action) which POSTs to config API URL from settings store
  implication: If configApiUrl is empty or wrong, the POST will fail silently (caught error only logged)

- timestamp: 2026-02-27T12:22:00Z
  checked: src/stores/settings.ts line 49
  found: configApiUrl defaults to empty string ''
  implication: If wizard didn't set it properly, all config API calls go to '' + '/api/service/start' = '/api/service/start' (relative URL)

- timestamp: 2026-02-27T12:25:00Z
  checked: vite.config.ts line 13-23
  found: Dev proxy forwards /api/* to http://172.16.10.1:9090 (mihomo API, NOT Flask backend on port 5000)
  implication: ROOT CAUSE 2 - In dev mode, relative /api/service/* requests go to mihomo:9090 instead of Flask:5000

## Resolution

root_cause: |
  TWO ROOT CAUSES:

  1. WRONG PROCESS NAME IN STATUS CHECK (backend/server.py:95)
     The endpoint uses `pidof mihomo` but the service is xkeen (xray-based).
     The process running is likely named `xray` or `xkeen`, not `mihomo`.
     This means status ALWAYS returns {running: false, pid: null} even when
     the service is running, so the badge is always red.

  2. VITE PROXY MISDIRECTS CONFIG API CALLS (vite.config.ts:14-22)
     The vite dev proxy sends ALL /api/* requests to http://172.16.10.1:9090
     (the mihomo API). But service management endpoints (/api/service/*)
     should go to Flask backend on port 5000. If configApiUrl in the settings
     store is empty or relative, the calls hit mihomo instead of Flask, so
     start/stop/restart never reach the correct backend.

     Additionally, config-api.ts:38 fetchServiceStatus() doesn't check res.ok
     before calling res.json(), so if mihomo returns a non-JSON error for
     /api/service/status, it could throw and be silently caught.

fix: (not applied - diagnosis only)
verification: (not applied)
files_changed: []
