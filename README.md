# My Recipe Book

Paste a link to a recipe blog and the app pulls out the ingredients, steps,
nutritional info, and video (when available) so you don't have to scroll
through someone's life story to get to the recipe.

- **Frontend**: React (Vite) — an inbox to submit links, a list of saved
  recipes, a tabbed detail view (Ingredients / Steps / Nutrition), and a
  per-recipe "Adapt" tab that rewrites a recipe for dietary restrictions.
- **Backend**: Express API that fetches a submitted URL, parses it for
  recipe data, stores the result, and proxies the adaptation chat to
  Amazon Bedrock.
- **Storage**: PostgreSQL, hosted for free on [Neon](https://neon.tech).

## Prerequisites

- Node.js 26.7.0 (see `.nvmrc` — run `nvm use`) and npm
- A free [Neon](https://neon.tech) account (or any Postgres instance)
- For the recipe-adaptation chat: AWS credentials and access to a Claude
  model on [Amazon Bedrock](https://console.aws.amazon.com/bedrock/) (request
  model access in the console, in the region you set as `AWS_REGION`)

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

   - Paste your connection string into `server/.env` as `DATABASE_URL`.
   - For the adaptation chat, set `AWS_REGION` and `BEDROCK_MODEL_ID`, and
     provide AWS credentials by any standard method (env vars, `aws sso login`,
     `~/.aws/credentials`, …). The identity needs `bedrock:InvokeModel` on the
     model in `BEDROCK_MODEL_ID`. The chat panel is the only feature that needs
     this — the rest of the app runs without it.

4. Create the `recipes` table:

   ```bash
   psql "$DATABASE_URL" -f server/db/schema.sql
   ```

   (No `psql` installed? Paste the contents of `server/db/schema.sql` into
   the Neon dashboard's SQL editor instead.)

   If you set the database up before the adaptation chat existed, apply the
   migration too:

   ```bash
   psql "$DATABASE_URL" -f server/db/migrations/001_derived_recipes.sql
   ```

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

## Recipe adaptation chat

Each recipe's detail view has an **"Adapt"** tab alongside Ingredients / Steps /
Nutrition. Describe a restriction ("make it vegan", "no nuts, dairy-free", "lower
sodium") and the backend sends the recipe plus your message to a Claude model on
Amazon Bedrock (via the Converse API in `server/bedrock.js`). The model replies in
the tab and, once it has a full rewrite, returns a structured recipe you can
**save as a new recipe** — stored with no `source_url` and a `derived_from`
pointer to the original. Conversations are not persisted; they reset when you
switch recipes.

Configure with `AWS_REGION` and `BEDROCK_MODEL_ID` (see Setup). If credentials
or model access are missing, the chat endpoint returns `502` and the rest of
the app is unaffected.

## API

| Method | Route                        | Description                                        |
| ------ | ---------------------------- | ------------------------------------------------- |
| GET    | `/api/recipes`              | List all saved recipes                            |
| POST   | `/api/recipes`              | Add a recipe from `{ "url": "..." }`              |
| GET    | `/api/recipes/:id`          | Get a single recipe                               |
| PATCH  | `/api/recipes/:id`          | Rename a recipe from `{ "title": "..." }`         |
| DELETE | `/api/recipes/:id`          | Remove a recipe                                   |
| POST   | `/api/recipes/:id/adapt`    | Adaptation chat turn: `{ "messages": [...] }` → `{ reply, adaptedRecipe }` |
| POST   | `/api/recipes/:id/adaptations` | Save an adapted recipe: `{ "recipe": {...} }` → the new recipe |

## Other scripts

```bash
npm run build    # production build of the frontend
npm run lint     # eslint
npm run preview  # preview the production build
```

## Deploy to AWS EKS

A single Docker image bundles the built SPA and the Express API (Express serves
`dist/` and `/api/*` on the same origin). Terraform stands up the cluster and its
supporting infrastructure; the image build and app rollout are manual `kubectl`
steps.

- `Dockerfile` — multi-stage build (Vite build → Node 26 runtime).
- `infra/terraform/` — VPC (single NAT gateway), EKS + one `t3.small` managed
  node group, ECR repo, and the AWS Load Balancer Controller (Helm + IRSA).
- `k8s/` — Namespace, Deployment, Service, and an ALB `Ingress`, wired with
  `kustomize`.

The database stays on **Neon**; its connection string is supplied as a
Kubernetes Secret (`recipebook-db`), never baked into the image or committed.

`k8s/deployment.yaml` sets `AWS_REGION` and `BEDROCK_MODEL_ID` for the
adaptation chat. **The pods also need `bedrock:InvokeModel` permission** — this
is not yet wired in `infra/terraform/`. Add an IAM policy granting
`bedrock:InvokeModel` on the model ARN, create an IRSA role for it
(`iam-role-for-service-accounts-eks`, as `alb_controller.tf` already does for
the load-balancer controller), create a `ServiceAccount` annotated with that
role ARN, and set `spec.template.spec.serviceAccountName` on the Deployment.
Until then the chat endpoint returns `502` in-cluster while the rest of the app
works.

### Prerequisites

AWS CLI (authenticated), `terraform` >= 1.6, `kubectl`, `docker`, and the Neon
`DATABASE_URL` for a database that already has `server/db/schema.sql` applied.

### 1. Provision infrastructure (~15–20 min)

```bash
cd infra/terraform
terraform init
terraform apply
```

### 2. Point kubectl at the cluster and confirm the ALB controller is up

```bash
aws eks update-kubeconfig --region us-east-1 --name recipebook
kubectl -n kube-system rollout status deploy/aws-load-balancer-controller
```

### 3. Build and push the image

EKS nodes are x86_64, so build for `linux/amd64` even from an Apple Silicon Mac.

```bash
ECR=$(terraform -chdir=infra/terraform output -raw ecr_repository_url)
aws ecr get-login-password --region us-east-1 \
  | docker login --username AWS --password-stdin "${ECR%/*}"
docker build --platform linux/amd64 -t "$ECR:v1" .
docker push "$ECR:v1"
```

### 4. Create the namespace and the database Secret

```bash
kubectl apply -f k8s/namespace.yaml
kubectl -n recipebook create secret generic recipebook-db \
  --from-literal=DATABASE_URL='postgresql://USER:PASS@HOST-pooler.REGION.aws.neon.tech/neondb?sslmode=require'
```

### 5. Deploy

Set the image in `k8s/kustomization.yaml` (`images[0].newName` → the ECR repo
URL, `newTag` → `v1`), then:

```bash
kubectl apply -k k8s/
kubectl -n recipebook rollout status deploy/recipebook
kubectl -n recipebook get ingress recipebook -w   # wait for the ADDRESS (ALB DNS)
```

Open `http://<alb-dns>/` in a browser.

### Teardown

```bash
kubectl delete -k k8s/          # removes the Ingress first, so the ALB is deleted
cd infra/terraform && terraform destroy
```

Deleting the `Ingress` before `terraform destroy` matters — an ALB left behind by
the controller blocks VPC deletion. Roughly **$4–6/day** while the cluster runs
(EKS control plane, one node, the NAT gateway, and the ALB).
