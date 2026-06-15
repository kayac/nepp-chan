CREATE TABLE IF NOT EXISTS ontology_snapshots (
  id TEXT PRIMARY KEY,
  data_json TEXT NOT NULL,
  entity_count INTEGER NOT NULL,
  generated_at TEXT NOT NULL,
  generated_by TEXT NOT NULL
);
