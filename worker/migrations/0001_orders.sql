CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  app TEXT NOT NULL,
  session_id TEXT UNIQUE,
  price_id TEXT,
  product_id TEXT,
  currency TEXT,
  unit_amount INTEGER,
  amount_subtotal INTEGER,
  amount_total INTEGER,
  payment_intent_id TEXT,
  checkout_status TEXT NOT NULL DEFAULT 'creating',
  payment_status TEXT NOT NULL DEFAULT 'unpaid',
  fulfillment_status TEXT NOT NULL DEFAULT 'pending',
  refunded_amount INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'api',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  fulfilled_at INTEGER,
  last_event_at INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_orders_app_created ON orders(app, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_orders_payment_intent ON orders(payment_intent_id);
CREATE TABLE IF NOT EXISTS stripe_events (
  id TEXT PRIMARY KEY,
  app TEXT NOT NULL,
  type TEXT NOT NULL,
  stripe_created_at INTEGER NOT NULL,
  processed_at INTEGER NOT NULL
);
