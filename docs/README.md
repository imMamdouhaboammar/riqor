<div align="center">
  <img src="assets/logo.svg" alt="Riqor Logo" width="340" />
</div>

# Riqor Documentation Hub

Welcome to the **Riqor Documentation Hub**. This site is organized using the **Divio Documentation System**, separating content into four distinct quadrants based on reader intent:

- **Tutorials**: Guided 0-to-1 learning for getting started.
- **How-To Guides**: Practical step-by-step recipes for specific tasks.
- **Reference**: Exact specifications, CLI options, and technical details.
- **Explanation**: Architectural concepts, security boundaries, and design choices.

---

## Documentation Matrix

| Quadrant | Purpose | Target Audience | Key Documents |
| --- | --- | --- | --- |
| 🎓 **[Tutorials](tutorials/quick-start-tutorial.md)** | Learning-oriented step-by-step guides | New users & developers onboarding to Riqor | • [Quick Start (10 Min)](tutorials/quick-start-tutorial.md)<br>• [First Evidence Loop](tutorials/first-evidence-loop-tutorial.md) |
| 🛠️ **[How-To Guides](how-to/setup-activator-checkpoints.md)** | Task-oriented problem solving | Developers configuring sessions, CI, or troubleshooting | • [Activator Checkpoints](how-to/setup-activator-checkpoints.md)<br>• [Evidence Gates](how-to/configure-evidence-gates.md)<br>• [CI/CD & Automation](how-to/integrate-ci-cd-and-automation.md)<br>• [Troubleshooting Recipes](how-to/troubleshoot-riqor-issues.md) |
| 📑 **[Reference](reference/cli-reference.md)** | Information-oriented technical specs | Engineers looking up flags, schemas, or APIs | • [CLI Reference](reference/cli-reference.md)<br>• [Agent Skills Pack](reference/skills-pack-reference.md)<br>• [Schema & State Spec](reference/schema-and-state-reference.md) |
| 💡 **[Explanation](explanation/architecture-overview.md)** | Understanding-oriented conceptual depth | Architects, security reviewers, and maintainers | • [Architecture Overview](explanation/architecture-overview.md)<br>• [Security & Trust Model](explanation/security-and-trust-model.md)<br>• [Evidence Gate Lifecycle](explanation/evidence-gate-lifecycle.md) |

---

## System Architecture at a Glance

```mermaid
flowchart TD
    SubGraph1[User Interface]
        CLI[riqor CLI]
        Aliases[codex-harness / cxh]
    end

    SubGraph2[Execution Layer]
        AgentSession[Managed Codex / AGY Process]
        ShellHooks[Local Shell Integration / zsh / bash]
    end

    SubGraph3[Core Engine]
        EvidenceEngine[Evidence Gate]
        ActivatorEngine[Session Activator & Watchdog]
        RunEngine[Run Store & Trace Logger]
    end

    SubGraph4[Storage Layer]
        XDG_Data[(~/.local/share/riqor)]
        XDG_State[(~/.local/state/riqor)]
    end

    CLI --> AgentSession
    Aliases --> CLI
    ShellHooks --> EvidenceEngine
    AgentSession --> ActivatorEngine
    EvidenceEngine --> RunEngine
    ActivatorEngine --> RunEngine
    RunEngine --> XDG_State
    CLI --> XDG_Data
```

---

## Key Core Concepts

### 1. Evidence Pending State
When a developer or agent executes a command that modifies the workspace (e.g., `git checkout`, `touch`, `edit`), Riqor marks the session state as `verification-pending`. The state remains pending until a recognized test or verification command (e.g., `bun test`, `pytest`, `cargo test`) runs successfully.

### 2. Managed Agent Sessions
Sessions launched via `riqor codex` or `riqor agy` run in a controlled child process environment with lifecycle hooks attached. This allows Riqor to enforce evidence gates and trigger task activator reviews without modifying the underlying agent binary.

### 3. Session Activator & Watchdog
Activated with `--activator`, the activator triggers periodic task reviews at safe agent `Stop` boundaries. The review phase is guarded by a watchdog bound (default 3 minutes) to ensure that the agent does not get stuck in recursive review loops.

### 4. Repository Runs & Traces
A **Run** binds an explicit goal to a repository identity. Traces store append-only JSON Lines events (`events.jsonl`) recording state changes, command hashes, and verification milestones while strictly filtering out sensitive source code, prompts, and credentials.

---

## Directory Navigation

- 📁 **[`tutorials/`](tutorials/quick-start-tutorial.md)** — Step-by-step tutorials
- 📁 **[`how-to/`](how-to/setup-activator-checkpoints.md)** — Operational recipes
- 📁 **[`reference/`](reference/cli-reference.md)** — Complete reference manuals
- 📁 **[`explanation/`](explanation/architecture-overview.md)** — Theoretical deep dives
- 📄 **[`SECURITY.md`](../SECURITY.md)** — Private vulnerability disclosure policy
- 📄 **[`CONTRIBUTING.md`](../CONTRIBUTING.md)** — Development and contribution guidelines
- 📄 **[`CHANGELOG.md`](../CHANGELOG.md)** — Release history and migration notes
