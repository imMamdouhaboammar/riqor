# Agent Skills Pack Reference Catalog (`riqor-pack`)

Riqor packages a canonical **Agent Skills Pack** under `skills/riqor-pack/`. These skills provide AI agents (Codex and Antigravity) with structured instructions for codebase inspection, evidence gating, verification, and session continuity.

---

## Skills Catalog Overview

| Skill Name | Purpose | Target Surface |
| --- | --- | --- |
| **`riqor-agent-orchestrator`** | Orchestrate autonomous goal loops, loopy convergence, and multi-agent pipelines | Goal orchestration & multi-agent execution |
| **`riqor-code-intelligence`** | Codebase indexing, AST chunking, symbol relevance, and code-path tracing | Code search & intelligence |
| **`riqor-conventions`** | Enforce packaging, installation, release gates, and workspace rules for Riqor | Core repository conventions & packaging |
| **`riqor-session-continuity`** | Context tracking, task intent preservation, state recovery, and handoff notes | Session state & continuity |
| **`riqor-verification-gate`** | Empirical evidence verification before completion claims | Evidence gating & completion gates |

---

## Detailed Skill Specifications

### 1. `riqor-agent-orchestrator`
- **Location**: `skills/riqor-pack/riqor-agent-orchestrator/SKILL.md`
- **Use Case**: Use when executing autonomous agent loops or multi-agent verification pipelines in Riqor.
- **Key Capabilities**: Manages goal loops, evaluates progress metrics, dispatches verification sub-tasks, and handles failure recovery.

---

### 2. `riqor-code-intelligence`
- **Location**: `skills/riqor-pack/riqor-code-intelligence/SKILL.md`
- **Use Case**: Use when indexing codebase symbols, retrieving hybrid semantic relevance, or performing AST-based path tracing.
- **Key Capabilities**: Indexes TypeScript/JS AST nodes, searches symbol graphs, and traces caller/callee relationships without full context exhaustion.

---

### 3. `riqor-conventions`
- **Location**: `skills/riqor-pack/riqor-conventions/SKILL.md`
- **Use Case**: Use when modifying, packaging, testing, or releasing Riqor software components.
- **Key Capabilities**: Mandates empirical verification before completion, runtime boundaries (Node.js 22+, Python 3, Bun for repo dev), filesystem safety, SHA-256 provenance checks, and release checks.

---

### 4. `riqor-session-continuity`
- **Location**: `skills/riqor-pack/riqor-session-continuity/SKILL.md`
- **Use Case**: Use when managing session context, recovering from context resets, or logging handoffs.
- **Key Capabilities**: Tracks intent across turns, restores scratchpad state, and logs handoffs without storing sensitive credentials or raw code.

---

### 5. `riqor-verification-gate`
- **Location**: `skills/riqor-pack/riqor-verification-gate/SKILL.md`
- **Use Case**: Use when completing tasks, making workspace edits, or validating success criteria.
- **Key Capabilities**: Requires empirical test/build command outputs before claiming completion, blocking premature task resolution.

---

## Installation & Skill Curation Commands

To inspect, install, or verify the Riqor Skills Pack:

```bash
# Run skill health and curation checks
bun run skills:health

# Install canonical skills into local environment
bash scripts/install-riqor-skills-pack.sh
```
