---
name: evidence-engineering
description: Use for non-trivial coding, debugging, migration, review, or end-to-end implementation where Codex must inspect the real flow, make a bounded change, and provide fresh verification evidence before completion
---

# Evidence Engineering

1. Convert the request and active repository rules into observable acceptance criteria
2. Inspect the repository, package manager, dirty state, relevant callers, tests, and existing patterns before editing
3. Select only the skills and tools that directly match the task
4. Prefer deletion or reuse, then platform features, then installed dependencies, then the minimum new code
5. For unknown failures, trace the root cause before proposing a fix
6. For behavior changes, write or identify a check that fails before the change and passes after it
7. Preserve unrelated user changes and keep credentials out of prompts, logs, artifacts, and commits
8. Run the smallest focused check that would catch the defect, then required project gates
9. Use an independent reviewer for high-risk security, data, release, or cross-project changes
10. Finish with changed files, checks and exact outcomes, and anything not verified

Do not claim completion from a plan, a diff, an earlier agent report, or confidence alone
