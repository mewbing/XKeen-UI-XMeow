---
phase: 14-installer-setup-sh
plan: 02
subsystem: infra
tags: [shell, installer, posix-sh, init.d, entware, keenetic, sha256, github-releases]

# Dependency graph
requires:
  - phase: 14-installer-setup-sh
    provides: "Binary named xmeow-server with --version flag (plan 01)"
  - phase: 13-ci-cd-pipeline
    provides: "GitHub Releases with architecture-specific .tar.gz + checksums.txt + dist.tar.gz"
provides:
  - "Install-only POSIX sh script (setup.sh) for curl|sh one-liner deployment"
  - "Architecture auto-detection for arm64/mipsle/mips/amd64/armv7"
  - "SHA256 checksum verification of downloaded binary"
  - "init.d service script S99xmeow-ui with env var config sourcing"
  - "External-UI deployment to /opt/etc/mihomo/ui/"
  - ".gitattributes enforcing LF line endings for setup.sh"
affects: [15-self-update, 16-update-frontend]

# Tech tracking
tech-stack:
  added: []
  patterns: ["main() wrapper for curl|sh pipe safety", "POSIX sh only (no bashisms) for BusyBox ash", "bilingual output (ru/en) via $LANG detection"]

key-files:
  created:
    - setup.sh
    - .gitattributes
  modified: []

key-decisions:
  - "Install-only script -- no update/uninstall menu (updates via dashboard UI in Phase 15-16)"
  - "main() wrapper function for curl|sh pipe safety (prevents partial execution)"
  - "Bilingual output (ru/en) based on $LANG environment variable"
  - "Always overwrite init.d script on reinstall (structure may change between versions)"
  - "Preserve xmeow-ui.conf on reinstall (user env var settings)"
  - "external-ui: ui relative path in mihomo config (mihomo security restriction)"
  - "Two-stage MIPS endianness detection: opkg.conf first, od fallback"

patterns-established:
  - "POSIX sh compatibility: [ ] not [[ ]], printf not echo -e, . not source, command -v not which"
  - "main() wrapper: entire script in main() { ... }; main \"$@\" for pipe safety"
  - "Bilingual msg(): msg \"ru text\" \"en text\" selects based on detect_lang()"

requirements-completed: [INST-03, INST-04, INST-05]

# Metrics
duration: 8min
completed: 2026-03-03
---

# Phase 14 Plan 02: Install-Only setup.sh Summary

**POSIX sh installer script (353 lines) for Keenetic routers: arch detection, GitHub release download, SHA256 verification, init.d service, external-UI deployment -- all via `curl|sh` one-liner**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-03T09:00:00Z
- **Completed:** 2026-03-03T09:08:00Z
- **Tasks:** 2 (1 auto + 1 checkpoint:human-verify)
- **Files modified:** 2

## Accomplishments
- Created 353-line POSIX sh install-only script that deploys XMeow Server on Keenetic/Entware routers
- Architecture auto-detection supports arm64, mipsle, mips, amd64, armv7 with two-stage MIPS endianness detection
- SHA256 checksum verification from GitHub release checksums.txt before installing binary
- Creates init.d service (S99xmeow-ui) with env var config sourcing from /opt/etc/xmeow-ui/xmeow-ui.conf
- Deploys external-UI SPA to /opt/etc/mihomo/ui/ and sets `external-ui: ui` in mihomo config
- Bilingual output (Russian/English) auto-detected from $LANG
- .gitattributes ensures LF line endings for setup.sh (CRLF causes BusyBox ash errors)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create .gitattributes and setup.sh install-only script** - `5ae2eaa` (feat)
2. **Task 1 fix: Ensure LF line endings in setup.sh** - `d630d5e` (fix)

Task 2 was a checkpoint:human-verify -- router testing deferred until GitHub release is published.

## Files Created/Modified
- `setup.sh` - 353-line POSIX sh install-only script: arch detection, GitHub release download, SHA256 verification, binary install, external-UI deploy, init.d service, config creation, bilingual output
- `.gitattributes` - Enforces LF line endings for setup.sh to prevent BusyBox ash CRLF errors

## Decisions Made
- Install-only (no update/uninstall menu) -- updates will be handled through dashboard UI in Phase 15-16
- main() wrapper pattern for curl|sh pipe safety -- prevents partial script execution if download is interrupted
- Bilingual output (ru/en) auto-detected from $LANG -- Russian text for ru_* locales, English otherwise
- init.d script always overwritten on reinstall (structure may change), but xmeow-ui.conf preserved (user settings)
- external-ui path set as relative `ui` (not absolute) due to mihomo security restriction on paths outside workdir
- Two-stage MIPS detection: first check opkg.conf for mipsel/mips, fallback to `od` byte order test

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed CRLF line endings in setup.sh**
- **Found during:** Task 1 verification
- **Issue:** Windows development environment wrote CRLF line endings; BusyBox ash fails with "set: line 5: illegal option -" on CRLF files
- **Fix:** Created .gitattributes with `setup.sh text eol=lf` and ran `git add --renormalize setup.sh`
- **Files modified:** .gitattributes, setup.sh
- **Verification:** File has LF endings after renormalization
- **Committed in:** `d630d5e`

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Essential fix -- CRLF would break the script on all routers. No scope creep.

## Issues Encountered
- Router testing deferred: setup.sh requires a published GitHub release with binary assets to function. Testing will be done after the first release is pushed to GitHub.

## User Setup Required
None - no external service configuration required. Router testing deferred until GitHub release is available.

## Next Phase Readiness
- Phase 14 complete -- installer script ready for deployment
- First GitHub release (v0.1.0 tag) needed before testing curl|sh on actual router
- Ready for Phase 15: Self-Update Backend -- init.d service script provides restart mechanism for self-update
- S99xmeow-ui service structure documented for Phase 15 graceful restart implementation

## Self-Check: PASSED

- FOUND: setup.sh
- FOUND: .gitattributes
- FOUND: 14-02-SUMMARY.md
- FOUND: commit 5ae2eaa
- FOUND: commit d630d5e

---
*Phase: 14-installer-setup-sh*
*Completed: 2026-03-03*
