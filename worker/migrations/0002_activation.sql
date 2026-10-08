CREATE TABLE IF NOT EXISTS activation_claims (
  token_hash TEXT PRIMARY KEY,
  app TEXT NOT NULL,
  order_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_activation_order ON activation_claims(app, order_id);
CREATE TABLE IF NOT EXISTS order_emails (
  order_id TEXT PRIMARY KEY,
  app TEXT NOT NULL,
  email_hash TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_order_email ON order_emails(app, email_hash);
CREATE TABLE IF NOT EXISTS recovery_requests (
  id TEXT PRIMARY KEY,
  app TEXT NOT NULL,
  email_hash TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  verified_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_recovery_email ON recovery_requests(app, email_hash, created_at);
CREATE INDEX IF NOT EXISTS idx_recovery_ip ON recovery_requests(app, ip_hash, created_at);
