# Webhook delivery schema

Repair `schema.sql` for tenant-scoped webhook ingestion.

- A delivery belongs to an organization.
- Provider event IDs are idempotent within an organization and provider.
- Payload is required JSONB.
- Status is limited to pending, processing, succeeded, or failed; attempts is a non-negative integer.
- Workers query pending rows for one organization ordered by oldest first.
- Record the concrete constraints and index decision in `REVIEW.md`.
