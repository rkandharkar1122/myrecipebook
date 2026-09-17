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
  insertDerivedRecipe,
  updateRecipeTitle,
  deleteRecipeById,
  UNIQUE_VIOLATION,
} from './db.js';
import { scrapeRecipe } from './scraper.js';
import { adaptRecipeChat } from './bedrock.js';

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

const MAX_CHAT_MESSAGES = 20;
const MAX_CHAT_CONTENT = 4000;

function validateChatMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    return 'messages must be a non-empty array';
  }
  if (messages.length > MAX_CHAT_MESSAGES) {
    return `messages must have at most ${MAX_CHAT_MESSAGES} items`;
  }
  for (const m of messages) {
    if (!m || (m.role !== 'user' && m.role !== 'assistant')) {
      return "each message role must be 'user' or 'assistant'";
    }
    if (typeof m.content !== 'string' || !m.content.trim()) {
      return 'each message content must be a non-empty string';
    }
    if (m.content.length > MAX_CHAT_CONTENT) {
      return `each message content must be at most ${MAX_CHAT_CONTENT} characters`;
    }
  }
  if (messages[messages.length - 1].role !== 'user') {
    return 'the last message must be from the user';
  }
  return null;
}

app.post('/api/recipes/:id/adapt', async (req, res, next) => {
  try {
    const { messages } = req.body || {};
    const invalid = validateChatMessages(messages);
    if (invalid) return res.status(400).json({ error: invalid });

    const recipe = await getRecipeById(req.params.id);
    if (!recipe) return res.status(404).json({ error: 'Recipe not found' });

    const result = await adaptRecipeChat({ recipe, messages });
    res.json(result);
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    next(err);
  }
});

function validateAdaptedRecipe(recipe) {
  if (!recipe || typeof recipe !== 'object') return 'recipe is required';
  if (typeof recipe.title !== 'string' || !recipe.title.trim()) {
    return 'recipe.title is required';
  }
  for (const field of ['ingredients', 'steps']) {
    const value = recipe[field];
    if (!Array.isArray(value) || value.length === 0) {
      return `recipe.${field} must be a non-empty array`;
    }
    if (!value.every((item) => typeof item === 'string' && item.trim())) {
      return `recipe.${field} must contain only non-empty strings`;
    }
  }
  for (const field of ['servings', 'prepTime', 'cookTime']) {
    if (recipe[field] != null && typeof recipe[field] !== 'string') {
      return `recipe.${field} must be a string`;
    }
  }
  return null;
}

app.post('/api/recipes/:id/adaptations', async (req, res, next) => {
  try {
    const { recipe } = req.body || {};
    const invalid = validateAdaptedRecipe(recipe);
    if (invalid) return res.status(400).json({ error: invalid });

    const parent = await getRecipeById(req.params.id);
    if (!parent) return res.status(404).json({ error: 'Recipe not found' });

    const saved = await insertDerivedRecipe({
      title: recipe.title.trim(),
      servings: recipe.servings?.trim() || null,
      prepTime: recipe.prepTime?.trim() || null,
      cookTime: recipe.cookTime?.trim() || null,
      ingredients: recipe.ingredients.map((s) => s.trim()),
      steps: recipe.steps.map((s) => s.trim()),
      derivedFrom: parent.id,
    });
    res.status(201).json(saved);
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
