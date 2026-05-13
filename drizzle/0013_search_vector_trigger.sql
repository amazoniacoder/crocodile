-- Migration: replace GENERATED search_vector with trigger
-- Trigger fires only on INSERT or when title/description changes
-- UPDATE entities no longer recalculates search_vector

-- Step 1: drop GENERATED column
ALTER TABLE news_articles DROP COLUMN search_vector;

-- Step 2: add plain tsvector column
ALTER TABLE news_articles ADD COLUMN search_vector tsvector;

-- Step 3: backfill existing rows
UPDATE news_articles
SET search_vector =
  to_tsvector('russian', coalesce(title, '') || ' ' || coalesce(description, ''))
  ||
  to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, ''));

-- Step 4: trigger function
CREATE OR REPLACE FUNCTION news_articles_search_vector_update()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT'
     OR NEW.title IS DISTINCT FROM OLD.title
     OR NEW.description IS DISTINCT FROM OLD.description
  THEN
    NEW.search_vector :=
      to_tsvector('russian', coalesce(NEW.title, '') || ' ' || coalesce(NEW.description, ''))
      ||
      to_tsvector('english', coalesce(NEW.title, '') || ' ' || coalesce(NEW.description, ''));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 5: attach trigger
DROP TRIGGER IF EXISTS tsvector_update ON news_articles;
CREATE TRIGGER tsvector_update
  BEFORE INSERT OR UPDATE ON news_articles
  FOR EACH ROW EXECUTE FUNCTION news_articles_search_vector_update();

-- Step 6: restore GIN index
CREATE INDEX IF NOT EXISTS idx_news_articles_search_vector
  ON news_articles USING GIN(search_vector);
