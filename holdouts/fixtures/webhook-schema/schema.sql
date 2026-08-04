CREATE TABLE organizations (
  id uuid PRIMARY KEY
);

CREATE TABLE webhook_deliveries (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  provider text NOT NULL,
  event_id text NOT NULL,
  payload text,
  status text NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
