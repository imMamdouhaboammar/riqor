# Schema review

- Added organization references and the tenant-provider-event unique idempotency key.
- Constrained status and non-negative attempts.
- Kept payload as required JSONB.
- Added a partial pending index by organization and oldest creation time for the worker query.
