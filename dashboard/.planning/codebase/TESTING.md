# Testing Patterns

**Analysis Date:** 2026-03-01

## Test Framework

**Runner:**
- No test framework configured
- No test runner dependency in `package.json` (no vitest, jest, playwright, cypress)
- No test-related scripts in `package.json`

**Assertion Library:**
- Not applicable

**Run Commands:**
```bash
# No test commands available
pnpm lint              # ESLint only (no tests)
pnpm build             # TypeScript type-checking + Vite build
```

## Test File Organization

**Location:**
- No test files exist anywhere in the codebase
- No `*.test.*`, `*.spec.*`, or `__tests__/` directories found

**Naming:**
- Not established

**Structure:**
- Not established

## Test Coverage

**Current State:** Zero test coverage. The project has no automated tests of any kind.

**No test infrastructure exists:**
- No test configuration files (`vitest.config.*`, `jest.config.*`, `playwright.config.*`)
- No testing dependencies in `package.json`
- No test scripts
- No test utilities, fixtures, or mocks

## Type Safety as Primary Quality Gate

The project relies on TypeScript strict mode as the primary code quality mechanism:

**TypeScript Configuration** (`tsconfig.app.json`):
```json
{
  "strict": true,
  "noUnusedLocals": true,
  "noUnusedParameters": true,
  "noFallthroughCasesInSwitch": true,
  "erasableSyntaxOnly": true,
  "noUncheckedSideEffectImports": true
}
```

**Build-time verification:**
```bash
pnpm build    # Runs tsc -b && vite build — catches type errors
pnpm lint     # Runs eslint . — catches lint violations
```

## Recommended Test Setup (If Adding Tests)

Given the tech stack (React 19 + Vite 7 + TypeScript + Zustand), the recommended setup would be:

**Framework:** Vitest (native Vite integration, fast, compatible with React 19)

**Installation:**
```bash
pnpm add -D vitest @testing-library/react @testing-library/jest-dom jsdom
```

**Config file:** `vitest.config.ts`
```typescript
import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'

export default mergeConfig(viteConfig, defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
}))
```

**Priority test targets (highest value, lowest effort):**

1. **Pure utility functions** (`src/lib/format.ts`, `src/lib/flags.ts`, `src/lib/rules-parser.ts`):
   - Already have `@example` JSDoc tags that serve as test specifications
   - Zero dependencies, easy to test
   - `formatBytes`, `formatSpeed`, `formatUptime`, `formatDelay`
   - `extractCountryCode`, `getDisplayName`
   - `parseRuleString`, `groupBySections`, `buildRuleRaw`

2. **Store logic** (`src/stores/connections.ts`, `src/stores/rules-editor.ts`):
   - Complex state management with speed calculations, undo/redo
   - Zustand stores are testable outside React (call `getState()` and actions directly)
   - `updateSnapshot` speed calculation logic
   - `filteredConnections` filtering logic
   - Rules editor mutation + undo/redo flow

3. **API clients** (`src/lib/api.ts`, `src/lib/mihomo-api.ts`, `src/lib/config-api.ts`):
   - Mock `fetch` to test error handling, timeout behavior, auth header injection
   - Validate request shape (URL, method, headers, body)

## What NOT to Test

- **shadcn/ui primitives** (`src/components/ui/*`): Third-party generated code, tested upstream
- **Visual styling**: CSS/Tailwind classes — use visual regression if needed, not unit tests
- **Monaco Editor integration**: External library, mock at boundary

## Verification Without Tests

Current quality assurance relies on:

1. **TypeScript strict mode** — catches type errors at build time
2. **ESLint** — catches common React mistakes (hooks rules, refresh compliance)
3. **Manual testing** — developer verifies in browser
4. **`pnpm build`** — full type-check + production build serves as CI gate

---

*Testing analysis: 2026-03-01*
