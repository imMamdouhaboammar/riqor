CREATE TABLE organizations (
  id uuid PRIMARY KEY,
  name text NOT NULL
);

CREATE TABLE users (
  id uuid PRIMARY KEY,
  email text NOT NULL
);

CREATE TABLE memberships (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  user_id uuid NOT NULL
);

CREATE TABLE tasks (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  assignee_membership_id uuid,
  status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
