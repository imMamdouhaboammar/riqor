# Riqor Agent Skills Pack

The **Riqor Agent Skills Pack** provides pre-built, production-grade capabilities for AI Coding Agents (such as Google Antigravity AGY, Claude Code, OpenAI Codex, Gemini, Cursor) interacting with Riqor-managed codebases.

---

## Included Skills

| Skill | Purpose |
| --- | --- |
| [`riqor`](../.agents/skills/riqor/SKILL.md) | Conventions, release gates, provenance verification, and runtime boundaries. |
| [`riqor-verification-gate`](../.agents/skills/riqor-verification-gate/SKILL.md) | Enforces empirical verification before any completion claim. |
| [`riqor-session-continuity`](../.agents/skills/riqor-session-continuity/SKILL.md) | Context preservation, session activator, and task checkpointing. |
| [`riqor-code-intelligence`](../.agents/skills/riqor-code-intelligence/SKILL.md) | AST chunking, incremental symbol index, and hybrid retrieval search. |
| [`riqor-agent-orchestrator`](../.agents/skills/riqor-agent-orchestrator/SKILL.md) | Autonomous multi-agent goal loops and loopy convergence orchestration. |

---

## Installation

To install the Riqor Skills Pack into your local AI agent environments (`~/.gemini/config/skills`, `~/.codex/skills`, `~/.claude/skills`):

```bash
bun run skills:pack:install
```

Or run the shell script directly:

```bash
bash scripts/install-riqor-skills-pack.sh
```

---

## Usage in Agent Environments

### 1. Verification Gate
Whenever an AI agent modifies code, it checks session evidence status before reporting done:
```bash
riqor terminal status
```
If output is `verification-pending`, the agent runs targeted test suites (`bun test`, `npm test`) and confirms `riqor doctor` health before declaring completion.

### 2. Session Activator
Start a managed, periodic task checkpoint session:
```bash
riqor codex --activator --activator-interval 15m
# or for Antigravity:
riqor agy --activator --activator-interval 15m
```

### 3. Symbol Search & Code Intelligence
Find symbols and definitions across the codebase:
```bash
riqor harness search "GoalLoopOrchestrator"
```
