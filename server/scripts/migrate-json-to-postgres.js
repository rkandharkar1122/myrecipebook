import 'dotenv/config';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const { Pool } = pg;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, '..', 'data', 'recipes.json');

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set. Copy server/.env.example to server/.env and fill it in.');
  }

  const raw = await fs.readFile(DATA_FILE, 'utf-8');
  const recipes = JSON.parse(raw);

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  let inserted = 0;

  for (const recipe of recipes) {
    const { rowCount } = await pool.query(
      `INSERT INTO recipes (source_url, added_at, title, image, ingredients, steps, nutrition, video_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (source_url) DO NOTHING`,
      [
        recipe.sourceUrl,
        recipe.addedAt,
        recipe.title,
        recipe.image,
        JSON.stringify(recipe.ingredients ?? []),
        JSON.stringify(recipe.steps ?? []),
        recipe.nutrition ? JSON.stringify(recipe.nutrition) : null,
        recipe.videoUrl,
      ]
    );
    inserted += rowCount;
  }

  await pool.end();
  console.log(`Migrated ${inserted} of ${recipes.length} recipe(s) from ${DATA_FILE} (skipped duplicates).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
