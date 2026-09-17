import pg from 'pg';

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set. Copy server/.env.example to server/.env and fill it in.');
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

function toRecipe(row) {
  return {
    id: row.id,
    sourceUrl: row.source_url,
    addedAt: row.added_at.toISOString(),
    title: row.title,
    image: row.image,
    prepTime: row.prep_time,
    cookTime: row.cook_time,
    servings: row.servings,
    ingredients: row.ingredients,
    steps: row.steps,
    nutrition: row.nutrition,
    videoUrl: row.video_url,
    derivedFrom: row.derived_from ?? null,
  };
}

export async function listRecipes() {
  const { rows } = await pool.query('SELECT * FROM recipes ORDER BY added_at ASC');
  return rows.map(toRecipe);
}

export async function getRecipeById(id) {
  const { rows } = await pool.query('SELECT * FROM recipes WHERE id = $1', [id]);
  return rows[0] ? toRecipe(rows[0]) : null;
}

export async function findRecipeByUrl(sourceUrl) {
  const { rows } = await pool.query('SELECT * FROM recipes WHERE source_url = $1', [sourceUrl]);
  return rows[0] ? toRecipe(rows[0]) : null;
}

export async function insertRecipe(recipe) {
  const { rows } = await pool.query(
    `INSERT INTO recipes (source_url, title, image, prep_time, cook_time, servings, ingredients, steps, nutrition, video_url)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      recipe.sourceUrl,
      recipe.title,
      recipe.image,
      recipe.prepTime,
      recipe.cookTime,
      recipe.servings,
      JSON.stringify(recipe.ingredients),
      JSON.stringify(recipe.steps),
      recipe.nutrition ? JSON.stringify(recipe.nutrition) : null,
      recipe.videoUrl,
    ]
  );
  return toRecipe(rows[0]);
}

export async function insertDerivedRecipe(recipe) {
  const { rows } = await pool.query(
    `INSERT INTO recipes (source_url, title, image, prep_time, cook_time, servings, ingredients, steps, nutrition, video_url, derived_from)
     VALUES (NULL, $1, NULL, $2, $3, $4, $5, $6, NULL, NULL, $7)
     RETURNING *`,
    [
      recipe.title,
      recipe.prepTime,
      recipe.cookTime,
      recipe.servings,
      JSON.stringify(recipe.ingredients),
      JSON.stringify(recipe.steps),
      recipe.derivedFrom,
    ]
  );
  return toRecipe(rows[0]);
}

export async function updateRecipeTitle(id, title) {
  const { rows } = await pool.query(
    'UPDATE recipes SET title = $1 WHERE id = $2 RETURNING *',
    [title, id]
  );
  return rows[0] ? toRecipe(rows[0]) : null;
}

export async function deleteRecipeById(id) {
  const { rowCount } = await pool.query('DELETE FROM recipes WHERE id = $1', [id]);
  return rowCount > 0;
}

export const UNIQUE_VIOLATION = '23505';
