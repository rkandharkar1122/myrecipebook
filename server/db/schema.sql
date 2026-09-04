CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_url TEXT NOT NULL UNIQUE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  title TEXT NOT NULL,
  image TEXT,
  prep_time TEXT,
  cook_time TEXT,
  servings TEXT,
  ingredients JSONB NOT NULL DEFAULT '[]',
  steps JSONB NOT NULL DEFAULT '[]',
  nutrition JSONB,
  video_url TEXT
);
