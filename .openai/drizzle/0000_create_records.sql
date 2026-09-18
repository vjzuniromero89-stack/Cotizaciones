CREATE TABLE records (
  id TEXT PRIMARY KEY NOT NULL,
  number TEXT NOT NULL UNIQUE,
  record_type TEXT NOT NULL CHECK (record_type IN ('quote','order')),
  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  boxes_json TEXT NOT NULL,
  rates_json TEXT NOT NULL,
  totals_json TEXT NOT NULL,
  route TEXT NOT NULL CHECK (route IN ('miami','direct')),
  total REAL NOT NULL DEFAULT 0,
  total_boxes INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  confirmed_at TEXT
);
CREATE INDEX idx_records_type_status ON records(record_type, status);
CREATE INDEX idx_records_customer ON records(customer_name);
PRAGMA optimize;
