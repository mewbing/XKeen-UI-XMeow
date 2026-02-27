# Deferred Items - Phase 02

## Pre-existing TypeScript Errors (Out of Scope)

These errors exist in Phase 03 proxies files and are NOT caused by Phase 02 changes:

1. **src/components/proxies/ProxiesToolbar.tsx(2,1)**: TS6133 - 'cn' is declared but its value is never read
2. **src/pages/ProxiesPage.tsx(3,1)**: TS6133 - 'cn' is declared but its value is never read
3. **src/stores/proxies.ts(55,69)**: TS2741 - Property 'isDelayCacheValid' is missing in type

These should be addressed by Phase 03 gap closure plans.
