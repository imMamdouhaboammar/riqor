# Window normalization

This repository uses half-open integer windows `[start, end)`. Repair `coalesceWindows` so it returns a new sorted array, merges overlapping or touching windows, rejects `start >= end`, and never mutates the input windows or array. Preserve the exported API and add focused regression coverage.
