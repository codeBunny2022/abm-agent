-- You.com ABM Agent - Supabase Database Setup
-- Run this in your Supabase SQL Editor

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Table for ABM runs
CREATE TABLE IF NOT EXISTS abm_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company TEXT NOT NULL,
  domain TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'processing',
  result_json JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table for storing embeddings and insights
CREATE TABLE IF NOT EXISTS abm_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES abm_runs(id) ON DELETE CASCADE,
  content_json JSONB NOT NULL,
  embedding vector(1536) NOT NULL,
  citations JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for vector similarity search
CREATE INDEX IF NOT EXISTS abm_insights_embedding_idx 
ON abm_insights USING ivfflat (embedding vector_cosine_ops);

-- Index for run_id lookups
CREATE INDEX IF NOT EXISTS abm_insights_run_id_idx ON abm_insights(run_id);

-- RPC function for similarity search (more efficient)
CREATE OR REPLACE FUNCTION match_abm_insights(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 5,
  run_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  content_json jsonb,
  citations jsonb,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    abm_insights.id,
    abm_insights.content_json,
    abm_insights.citations,
    1 - (abm_insights.embedding <=> query_embedding) AS similarity
  FROM abm_insights
  WHERE (match_abm_insights.run_id IS NULL OR abm_insights.run_id = match_abm_insights.run_id)
    AND 1 - (abm_insights.embedding <=> query_embedding) > match_threshold
  ORDER BY abm_insights.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Grant necessary permissions (adjust as needed for your setup)
-- These are typically handled by Supabase automatically, but included for reference
-- GRANT USAGE ON SCHEMA public TO authenticated;
-- GRANT ALL ON abm_runs TO authenticated;
-- GRANT ALL ON abm_insights TO authenticated;
