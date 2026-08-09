# Riqor Harness Enhancements Design Spec (v0.7.0)

**Date**: 2026-08-09  
**Status**: APPROVED (Autonomous Execution)  
**Authors**: Antigravity AI & Riqor Architecture Team  

---

## 1. Overview & Inspiration

This specification enhances **Riqor** (`codex-self-improvement-harness`) by adapting proven open-source harness engineering patterns from six benchmark repositories without reinventing the wheel:

1. **`COG-second-brain`** → **Cognitive Memory Ledger**: Cross-session architectural memory and failure pattern index with strict privacy bounds.
2. **`i-have-adhd`** → **Anti-Overwhelm Focus Path**: Hyper-structured micro-step execution path for high-friction tasks.
3. **`robzilla1738/harness-terminal`** → **Interactive Terminal Dashboard**: Real-time terminal status badges and evidence telemetry in `cxh`/`riqor` CLI.
4. **`awesome-harness-engineering` & `revfactory/harness`** → **Spec-Driven Automated Evaluation**: Formalized harness path criteria and structured evaluation hooks.
5. **`Forward-Future/loopy`** → **Loopy Convergence Gate**: Iterative feedback convergence loop that re-verifies until evidence reaches 100% pass state.

---

## 2. Architecture & Components

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Riqor Harness v0.7.0                           │
└─────────────────────────────────────────────────────────────────────────────┘
          │                                                  │
          ▼                                                  ▼
┌───────────────────────────┐                      ┌───────────────────────────┐
│ Anti-Overwhelm Focus Path │                      │  Cognitive Memory Ledger  │
│ (hooks/paths.ts & router) │                      │ (src/cognitive-memory.ts) │
│ - Micro-step execution    │                      │ - Cross-session decisions │
│ - Single-action bounds    │                      │ - Privacy-safe SHA-256    │
└───────────────────────────┘                      └───────────────────────────┘
          │                                                  │
          ▼                                                  ▼
┌───────────────────────────┐                      ┌───────────────────────────┐
│ Interactive Terminal TUI  │                      │   Loopy Convergence Gate  │
│ (src/terminal-runtime.ts) │                      │ (src/deliberation-gate)   │
│ - Real-time state badges  │                      │ - Iterative re-check loop │
│ - Evidence progress bars  │                      │ - 100% evidence target    │
└───────────────────────────┘                      └───────────────────────────┘
```

### 2.1 Component 1: Anti-Overwhelm Focus Path (`focus` route)
- **Files**: `plugins/codex-self-improvement/hooks/paths.ts`, `plugins/codex-self-improvement/hooks/router.ts`
- **Behavior**:
  - Adds a new harness path `focus` (ADHD/Anti-Overwhelm execution mode).
  - Triggers when prompts contain keywords like `focus`, `step-by-step`, `micro`, `adhd`, `overwhelmed`, or when complex multi-part tasks are classified.
  - Objective: Single-action turns with micro-step checklists and immediate empirical verification after each mutation.

### 2.2 Component 2: Cognitive Memory Ledger (`src/cognitive-memory.ts`)
- **Files**: `src/cognitive-memory.ts`, `test/cognitive-memory.test.ts`
- **Behavior**:
  - Structured storage for architectural decisions and failure patterns per project root digest.
  - Stored under `PLUGIN_DATA/cognitive-memory.json` (or `.riqor/cognitive-memory.json`).
  - Owner-only (`0600`), maximum capacity (50 entries), FIFO pruning.
  - No raw prompts, no raw code snippets, no credentials, no absolute user paths.

### 2.3 Component 3: Interactive Terminal Dashboard (`src/terminal-runtime.ts`)
- **Files**: `src/terminal-runtime.ts`, `test/terminal-runtime.test.ts`
- **Behavior**:
  - Enhances `renderTerminalTrace` and `TerminalTrace` with visual ANSI status badges:
    - `[HARNESS: FOCUS]` / `[HARNESS: ENGINEERING]`
    - `[EVIDENCE: PENDING]` / `[EVIDENCE: VERIFIED]`
    - `[MEMORY: 12 PATTERNS]`
  - Formats clean terminal status banners for CLI interactive runs.

### 2.4 Component 4: Loopy Convergence Gate (`src/deliberation-gate.ts`)
- **Files**: `src/deliberation-gate.ts`, `test/deliberation-gate.test.ts`
- **Behavior**:
  - Exposes `evaluateConvergenceLoop(evidenceHistory, maxTurns)` logic.
  - Evaluates whether consecutive turns are converging towards 100% evidence verification.
  - Halts execution if evidence degrades or stalls for 3 consecutive turns (circuit breaker).

---

## 3. Verification & Quality Gates

1. **Test-Driven Development**: Every new module must have corresponding unit tests written first.
2. **Regression Suite**: All existing 304 unit tests must remain green.
3. **No Bun Dependency for Package**: Published runtime components must run in Node.js 22+ without requiring Bun.
4. **Architecture Conformance**: No circular dependencies, single source of truth for plugin state and terminal trace.
