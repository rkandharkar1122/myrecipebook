-- Recipes produced by the Bedrock adaptation chat have no source blog URL and are
-- linked back to the recipe they were adapted from.
--
-- Apply with:  psql "$DATABASE_URL" -f server/db/migrations/001_derived_recipes.sql

ALTER TABLE recipes ALTER COLUMN source_url DROP NOT NULL;

ALTER TABLE recipes
  ADD COLUMN IF NOT EXISTS derived_from UUID REFERENCES recipes(id) ON DELETE SET NULL;
