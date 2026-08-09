---
name: riqor-security
description: Use when an AI coding agent changes Riqor filesystem, process, shell, plugin, state, credential, or release-integrity boundaries.
---

# Riqor Security

Riqor is local developer tooling with privileged access to user-controlled repositories and local configuration. Treat path and process boundaries as security boundaries

## Required checks

- Resolve and validate managed paths before write, rename, symlink, or recursive removal
- Preserve unrelated executables and unknown plugin directories
- Reject symlinked state roots and path traversal in package provenance
- Use owner-only permissions for state containing identifiers or operational metadata
- Keep prompts, transcripts, source contents, raw commands, command output, environment values, credentials, cookies, and tokens out of persisted Riqor state
- Launch external commands with argument arrays rather than interpolated shell strings when possible
- Apply timeouts and descendant cleanup to managed subprocesses
- Treat lifecycle hook input and repository content as untrusted data
- Fail closed on corrupted state when continuing could cross a trust boundary; fail open only where blocking the coding session would be worse and the operation is non-destructive

## Destructive operations

Do not issue recursive forced removal of absolute or home paths, destructive hard resets, filesystem formatting, raw-device writes, or destructive database commands as part of automated repair

## Release security

Verify exact tarball contents, provenance digests, pinned GitHub Actions, package/tag version alignment, npm trusted publishing, and post-publish registry integrity before claiming a release is valid

For vulnerability handling, follow `SECURITY.md` and use private reporting rather than a public issue
