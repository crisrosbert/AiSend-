-- 2026_09_23_kb_chunk_embeddings.sql
--
-- Named by date, not a sequence number: this repo's migrations 001-009
-- are the only ones tracked here, but the live database is already past
-- them (retrieve.ts's own header references 015 and 030) — those were
-- applied directly and never committed. Reusing "010" here would look
-- like it comes before migrations that already ran.
--
-- Adds vector similarity search to the knowledge base. Chunks were only
-- reachable through Postgres full-text search (015_agent_tables.sql) —
-- it works, but only for shared words: a customer asking "do you take
-- walk-ins?" gets nothing back from a page that only ever says
-- "appointments welcome, no booking required", because the two sentences
-- share no words at all. Embeddings match on MEANING, not vocabulary.
--
-- Run this once in the Supabase SQL editor (there is no migration
-- runner wired into this repo — every migration here is applied by
-- hand, same as the ones before it).
--
-- Safe mid-rollout: existing chunks keep answering through the old
-- full-text search — embedding stays NULL on every row until its source
-- is re-ingested (re-run "train from URL", or re-save a text/FAQ
-- source), and match_kb_chunks below simply skips NULL-embedding rows
-- rather than erroring. Nothing already working stops working.

create extension if not exists vector;

alter table agent_kb_chunks
  add column if not exists embedding vector(1536);

-- HNSW over IVFFlat: IVFFlat needs a representative sample of rows
-- before it can build good clusters (an empty or near-empty table gives
-- it a bad index), which doesn't fit a table that grows one merchant's
-- site at a time rather than in one big bulk load. HNSW has no such
-- training step.
create index if not exists agent_kb_chunks_embedding_idx
  on agent_kb_chunks
  using hnsw (embedding vector_cosine_ops);

-- Mirrors search_kb_chunks' own scoping rules exactly: tenant_id is
-- always required, journey_id is optional (NULL = every journey this
-- tenant owns). Getting this wrong here would reopen the exact
-- cross-business leak src/lib/agent/knowledge-scope.test.ts exists to
-- catch — a fashion shop's agent answering out of a surgery clinic's
-- pages because the filter silently dropped.
create or replace function match_kb_chunks(
  p_tenant_id uuid,
  p_journey_id uuid,
  p_query_embedding vector(1536),
  p_max int default 5
)
returns table (
  id uuid,
  content text,
  source_id uuid,
  chunk_index int,
  rank float
)
language sql stable
as $$
  select
    c.id,
    c.content,
    c.source_id,
    c.chunk_index,
    1 - (c.embedding <=> p_query_embedding) as rank
  from agent_kb_chunks c
  where c.tenant_id = p_tenant_id
    and c.embedding is not null
    and (p_journey_id is null or c.journey_id = p_journey_id)
  order by c.embedding <=> p_query_embedding
  limit p_max;
$$;
