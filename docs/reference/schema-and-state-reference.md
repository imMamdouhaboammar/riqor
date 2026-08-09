# Schema & Local State Reference

This document provides the complete reference specification for Riqor's local state directories, file permissions, JSON schemas, and trace event structures.

---

## Local Directory Layout

Riqor adheres strictly to the **XDG Base Directory Specification** (with fallbacks to standard system defaults):

| Purpose | Default Path | Override Environment Variable | Directory Permissions | File Permissions |
| --- | --- | --- | ---: | ---: |
| **Payload Storage** | `~/.local/share/riqor/` | `XDG_DATA_HOME` | `0700` | `0600` |
| **Active Payload Symlink** | `~/.local/share/riqor/current` | `XDG_DATA_HOME` | `0700` | Symlink |
| **Configuration Manifests** | `~/.config/riqor/` | `XDG_CONFIG_HOME` | `0700` | `0600` |
| **Run Store & State** | `~/.local/state/riqor/` | `XDG_STATE_HOME` / `RIQOR_STATE_HOME` | `0700` | `0600` |
| **Executable Shims** | `~/.local/bin/` | `PATH` | System standard | Executable (`0755`) |

---

## Run Store Layout

Under `~/.local/state/riqor/projects/<repository-root-digest>/`:

```text
projects/<repository-root-digest>/
├── active.json          # Pointer to the currently active run ID
└── runs/
    └── <run-id>/
        ├── run.json     # Bounded run metadata record
        ├── events.jsonl # Append-only trace log
        └── .lock        # Exclusive file lock during trace mutations
```

---

## File Schemas

### 1. `run.json` Schema
```json
{
  "$schema": "https://riqor.dev/schemas/run.v1.json",
  "runId": "run_01j7xyz...",
  "repoDigest": "a3f89b...",
  "goal": "Add input validation for user configuration",
  "path": "evidence-loop",
  "profile": "assured",
  "status": "active",
  "evidencePending": false,
  "gitHead": "9f21b7c...",
  "gitDirty": true,
  "createdAt": "2026-08-09T11:00:00.000Z",
  "updatedAt": "2026-08-09T11:05:00.000Z",
  "completedAt": null
}
```

### 2. `events.jsonl` Event Schemas
Each line in `events.jsonl` is a single JSON object.

#### `run_started`
```json
{"seq":1,"timestamp":"2026-08-09T11:00:00.000Z","type":"run_started","goal":"Add input validation","path":"evidence-loop","profile":"assured"}
```

#### `workspace_mutated`
```json
{"seq":2,"timestamp":"2026-08-09T11:02:10.000Z","type":"workspace_mutated","commandDigest":"e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855","category":"mutation"}
```

#### `verification_completed`
```json
{"seq":3,"timestamp":"2026-08-09T11:04:30.000Z","type":"verification_completed","commandDigest":"8100a3593e32...","exitCode":0,"category":"verification"}
```

#### `run_completed`
```json
{"seq":4,"timestamp":"2026-08-09T11:05:00.000Z","type":"run_completed"}
```

---

## Security & Storage Invariants

1. **Zero Raw Content Retention**: Command strings, code diffs, prompts, and environment credentials are **never** stored in `run.json` or `events.jsonl`. Commands are reduced to SHA-256 digests.
2. **Atomic Writes**: All state updates to `run.json` use temporary files (`.tmp`) followed by atomic filesystem renames (`fs.rename`).
3. **Symlink Rejection**: State loaders reject symlinked target files to prevent arbitrary file path manipulation attacks.
