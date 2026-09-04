# My Recipe Book

Paste a link to a recipe blog and the app pulls out the ingredients, steps,
nutritional info, and video (when available) so you don't have to scroll
through someone's life story to get to the recipe.

- **Frontend**: React (Vite) — an inbox to submit links, a list of saved
  recipes, and a tabbed detail view (Ingredients / Steps / Nutrition).
- **Backend**: Express API that fetches a submitted URL, parses it for
  recipe data, and stores the result.
- **Storage**: PostgreSQL, hosted for free on [Neon](https://neon.tech).

## Prerequisites

- Node.js 18+ and npm
- A free [Neon](https://neon.tech) account (or any Postgres instance)

## Setup

1. Install dependencies for both the frontend and the backend:

   ```bash
   npm install
   npm install --prefix server
   ```

2. Create a free Neon project at [neon.tech](https://neon.tech) and copy its
   connection string (it looks like
   `postgresql://user:password@ep-xxxx.aws.neon.tech/neondb?sslmode=require`).

3. Set up your local env file:

   ```bash
   cp server/.env.example server/.env
   ```

   and paste your connection string into `server/.env` as `DATABASE_URL`.

4. Create the `recipes` table:

   ```bash
   psql "$DATABASE_URL" -f server/db/schema.sql
   ```

   (No `psql` installed? Paste the contents of `server/db/schema.sql` into
   the Neon dashboard's SQL editor instead.)

5. If you have existing recipes in `server/data/recipes.json` from an earlier
   version of the app, migrate them into Postgres (safe to re-run — it skips
   links already in the database):

   ```bash
   npm run migrate:json --prefix server
   ```

## Running the app

Run both the frontend and backend together:

```bash
npm run dev:all
```

- Frontend (Vite dev server): http://localhost:5173
- Backend (Express API): http://localhost:3001

The Vite dev server proxies `/api` requests to the backend, so the app
"just works" from http://localhost:5173.

Alternatively, run each piece in its own terminal:

```bash
npm run server   # backend on :3001
npm run dev      # frontend on :5173
```

## How recipe parsing works

When you submit a link, the backend fetches the page and looks for the
`schema.org/Recipe` structured data (JSON-LD) that most recipe blogs embed
for SEO — this gives clean ingredients, steps, nutrition, and video data. If
a site doesn't provide that, it falls back to a best-effort scan of the page
for elements whose class names suggest ingredients/instructions and any
Open Graph image/video tags. Sites with aggressive bot protection (e.g.
Cloudflare challenges) may fail to fetch.

## API

| Method | Route              | Description                          |
| ------ | ------------------ | ------------------------------------ |
| GET    | `/api/recipes`     | List all saved recipes               |
| POST   | `/api/recipes`     | Add a recipe from `{ "url": "..." }` |
| GET    | `/api/recipes/:id` | Get a single recipe                  |
| DELETE | `/api/recipes/:id` | Remove a recipe                      |

## Other scripts

```bash
npm run build    # production build of the frontend
npm run lint     # eslint
npm run preview  # preview the production build
```
