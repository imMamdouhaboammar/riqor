CREATE TABLE organizations (
  id uuid PRIMARY KEY,
  name text NOT NULL
);

CREATE TABLE users (
  id uuid PRIMARY KEY,
  email text NOT NULL UNIQUE
);

CREATE TABLE memberships (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id),
  user_id uuid NOT NULL REFERENCES users(id),
  UNIQUE (organization_id, user_id),
  UNIQUE (organization_id, id)
);

CREATE TABLE tasks (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id),
  assignee_membership_id uuid,
  status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id, assignee_membership_id)
    REFERENCES memberships (organization_id, id)
);

CREATE INDEX tasks_active_tenant_order
  ON tasks (organization_id, status, created_at DESC);
