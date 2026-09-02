ALTER TABLE review_decisions ADD COLUMN thread_id TEXT;
ALTER TABLE review_decisions ADD COLUMN evidence TEXT;

CREATE INDEX idx_review_decisions_thread ON review_decisions(thread_id);
