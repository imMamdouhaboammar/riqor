# Filename normalization

Repair `normalizeFilename` in `src/filename.ts` using the failure report in `EXTERNAL_ISSUE.md`.

The function must return a basename containing only ASCII letters, digits, dot, underscore, or hyphen; collapse other runs to one underscore; reject an empty result, `.` and `..`; preserve the exported API; and never create files outside the requested source/test change.
