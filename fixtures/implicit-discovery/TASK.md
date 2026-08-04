# PostgreSQL schema audit

Repair `schema.sql` for a multi-tenant task service. Membership is unique per organization and user. A task belongs to one organization, may be assigned only through a membership in that same organization, and active task lists filter by organization plus status ordered by newest first. Record concrete findings and decisions in `REVIEW.md`.
