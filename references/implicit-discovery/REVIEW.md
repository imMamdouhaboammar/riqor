# Schema review

- Added tenant foreign keys from memberships and tasks to organizations.
- Added the membership unique constraint for organization and user.
- Added a composite foreign key so an assignee membership must belong to the task tenant.
- Added the organization, status, newest-first index for the stated active-list query.
