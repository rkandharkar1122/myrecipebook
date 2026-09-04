import express from 'express';
import cors from 'cors';
import {
  listRecipes,
  getRecipeById,
  findRecipeByUrl,
  insertRecipe,
  updateRecipeTitle,
  deleteRecipeById,
  UNIQUE_VIOLATION,
} from './db.js';
import { scrapeRecipe } from './scraper.js';

const app = express();

app.use(cors());
app.use(express.json());

app.get('/api/recipes', async (req, res, next) => {
  try {
    res.json(await listRecipes());
  } catch (err) {
    next(err);
  }
});

app.get('/api/recipes/:id', async (req, res, next) => {
  try {
    const recipe = await getRecipeById(req.params.id);
    if (!recipe) return res.status(404).json({ error: 'Recipe not found' });
    res.json(recipe);
  } catch (err) {
    next(err);
  }
});

app.post('/api/recipes', async (req, res, next) => {
  try {
    const { url } = req.body || {};
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'url is required' });
    }

    let parsedUrl;
    try {
      parsedUrl = new URL(url);
    } catch {
      return res.status(400).json({ error: 'Invalid URL' });
    }
    if (!/^https?:$/.test(parsedUrl.protocol)) {
      return res.status(400).json({ error: 'URL must use http or https' });
    }

    const normalizedUrl = parsedUrl.toString();
    if (await findRecipeByUrl(normalizedUrl)) {
      return res.status(409).json({ error: 'This link has already been added' });
    }

    let scraped;
    try {
      scraped = await scrapeRecipe(normalizedUrl);
    } catch (err) {
      return res.status(422).json({ error: `Could not parse recipe: ${err.message}` });
    }

    let recipe;
    try {
      recipe = await insertRecipe({ sourceUrl: normalizedUrl, ...scraped });
    } catch (err) {
      if (err.code === UNIQUE_VIOLATION) {
        return res.status(409).json({ error: 'This link has already been added' });
      }
      throw err;
    }

    res.status(201).json(recipe);
  } catch (err) {
    next(err);
  }
});

app.patch('/api/recipes/:id', async (req, res, next) => {
  try {
    const { title } = req.body || {};
    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ error: 'title is required' });
    }

    const recipe = await updateRecipeTitle(req.params.id, title.trim());
    if (!recipe) return res.status(404).json({ error: 'Recipe not found' });
    res.json(recipe);
  } catch (err) {
    next(err);
  }
});

app.delete('/api/recipes/:id', async (req, res, next) => {
  try {
    const deleted = await deleteRecipeById(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Recipe not found' });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

export default app;
