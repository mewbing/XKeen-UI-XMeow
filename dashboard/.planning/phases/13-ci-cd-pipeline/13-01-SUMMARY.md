---
phase: 13-ci-cd-pipeline
plan: 01
status: complete
started: 2026-03-03
completed: 2026-03-03
duration: 5min
tasks_completed: 2
files_created:
  - .github/workflows/ci.yml
  - .github/workflows/release.yml
  - README.md
commits:
  - "feat(ci): add CI workflow and README.md"
  - "feat(ci): add Release workflow with cross-compilation matrix"
---

# Summary: CI/CD Pipeline

## What was built

### CI Workflow (`.github/workflows/ci.yml`)
- Triggers on push/PR to `main`
- Steps: checkout -> pnpm setup -> Node 22 setup -> pnpm install -> pnpm build -> Go 1.25 setup -> go build
- pnpm/action-setup BEFORE setup-node (required for cache to work)
- CGO_ENABLED=0 for reproducible builds

### Release Workflow (`.github/workflows/release.yml`)
- Triggers on tag push `v*.*.*`
- **Job 1: build-frontend** — builds SPA with pnpm, uploads dist/ artifact
- **Job 2: build-binaries** — matrix cross-compilation for 5 architectures:
  - linux/arm64 (Keenetic KN-1811/1812)
  - linux/mipsle softfloat (Keenetic 4G/Lite)
  - linux/mips softfloat (Keenetic Omni)
  - linux/amd64 (servers)
  - linux/armv7 (Keenetic Giga/Ultra)
- Downloads dist/ artifact, builds Go binary with version injection via ldflags
- UPX compression (--best --lzma) via crazy-max/ghaction-upx@v3
- Packages as `xmeow-ui_{version}_{os}_{arch}.tar.gz` (flat, no subdirectory)
- **Job 3: release** — collects all binaries, creates dist.tar.gz, generates SHA256 checksums, creates GitHub Release with auto-generated notes and prerelease detection

### README.md
- Project description in Russian
- Usage instructions with env variables (XMEOW_PORT, MIHOMO_CONFIG_PATH, MIHOMO_API_URL, XMEOW_SECRET)
- Supported architectures table

## Requirements covered
- **CICD-01**: CI check on push/PR to main (frontend + backend build)
- **CICD-02**: Cross-compilation matrix for 5 architectures with GOMIPS=softfloat
- **CICD-03**: UPX compression and tar.gz packaging
- **CICD-04**: Automated GitHub Release with checksums and version injection

## Key decisions
- GOMIPS/GOARM passed via `env:` block (empty string = unset = Go default)
- Flat tar.gz archives (files at root, no subdirectory)
- dist.tar.gz separate for external-ui mode updates
- prerelease auto-detected from hyphen in tag name (e.g., v1.0.0-beta)
