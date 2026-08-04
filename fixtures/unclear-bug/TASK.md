# Intermittent localization bug

Users report that switching locale sometimes keeps the previous product label, and one caller occasionally changes another caller's rendered tags. Trace every caller of the shared cache in `src/` and fix the shared root cause. Preserve the public functions and add regression tests for the actual failure modes.
