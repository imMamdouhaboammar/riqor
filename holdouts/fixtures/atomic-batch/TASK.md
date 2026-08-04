# Atomic balance batch

Repair `applyBatch` in `src/batch.ts`.

- Operations have a unique ID, type `credit` or `debit`, and a positive integer cent amount.
- Apply operations in order and return the final balance plus applied IDs.
- If any operation is invalid, duplicated, or would make the balance negative, reject the entire batch.
- Do not mutate the operation array or its objects.
- Preserve exported names and add focused regression coverage.
