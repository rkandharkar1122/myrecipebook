import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
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
const PORT = process.env.PORT || 3001;
const distDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');

app.use(cors());
app.use(express.json());

app.get('/healthz', (req, res) => {
  res.json({ ok: true });
});

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

// Serve the built frontend (present in the container image; absent in local
// API-only dev, where Vite serves the SPA instead).
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Recipe server listening on http://localhost:${PORT}`);
});
