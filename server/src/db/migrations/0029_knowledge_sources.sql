CREATE TABLE knowledge_sources (
  source_path TEXT PRIMARY KEY,
  canonical_url TEXT,
  source_type TEXT,
  source_authority INTEGER,
  source_hash TEXT,
  r2_etag TEXT,
  chunk_count INTEGER NOT NULL DEFAULT 0,
  approval_status TEXT NOT NULL DEFAULT 'pending',
  approved_by TEXT,
  approved_at TEXT,
  disabled_at TEXT,
  verified_at TEXT,
  indexed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT
);

CREATE INDEX idx_knowledge_sources_status ON knowledge_sources(approval_status);
CREATE INDEX idx_knowledge_sources_canonical_url ON knowledge_sources(canonical_url);
