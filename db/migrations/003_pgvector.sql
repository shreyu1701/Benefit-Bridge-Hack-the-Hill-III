-- requires: vector
-- Semantic search over approved program text (Gemini embeddings, 768 dims).
CREATE TABLE IF NOT EXISTS program_embeddings (
  program_id   text NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  lang         text NOT NULL,
  content_hash text NOT NULL,
  embedding    vector(768) NOT NULL,
  PRIMARY KEY (program_id, lang)
);
CREATE INDEX IF NOT EXISTS program_embeddings_hnsw ON program_embeddings USING hnsw (embedding vector_cosine_ops);
