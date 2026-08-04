CREATE TABLE organizations (
  id uuid PRIMARY KEY
);

CREATE TABLE webhook_deliveries (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  provider text NOT NULL,
  event_id text NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL CHECK (status IN ('pending', 'processing', 'succeeded', 'failed')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, provider, event_id),
  FOREIGN KEY (organization_id) REFERENCES organizations(id)
);

CREATE INDEX webhook_pending_by_tenant
  ON webhook_deliveries (organization_id, created_at)
  WHERE status = 'pending';
