# Deploying the architect dashboard

The dashboard uses **PostgreSQL** for data. You scrape **offline** on your machine, push data into Postgres, then deploy the app to **Vercel**.

---

## 1. PostgreSQL database

Use any Postgres host that gives you a connection URL. Options:

### Option A: Vercel Marketplace (recommended)

1. In your [Vercel project](https://vercel.com/dashboard) go to **Storage** or **Integrations**.
2. Add a **Postgres** integration (e.g. **Neon**, **Supabase**, or **Vercel Postgres** if available).
3. The integration will create a database and set **`DATABASE_URL`** (or **`POSTGRES_URL`**) in your project env.

### Option B: Neon (free tier)

1. Go to [Neon](https://neon.tech) and create a free account.
2. Create a project and copy the **connection string** (e.g. `postgresql://user:pass@ep-xxx.region.aws.neon.tech/neondb?sslmode=require`).
3. In Vercel → Project → **Settings** → **Environment Variables**, add:
   - **Name:** `DATABASE_URL`
   - **Value:** your Neon connection string

### Option C: Supabase

1. Create a project at [Supabase](https://supabase.com).
2. In **Project Settings** → **Database** copy the **URI** (connection string).
3. Add it as **`DATABASE_URL`** in Vercel.

---

## 2. Workflow: scrape offline, then deploy

**On your machine (offline):**

```bash
# Scrape (writes architects.json)
python scrape_architects.py

# Push data to your Postgres (set DATABASE_URL first)
set DATABASE_URL=postgresql://user:pass@host:5432/dbname
python import_data.py
```

**Deployed app on Vercel** uses the same **`DATABASE_URL`**, so the live site shows the data you imported.

---

## 3. Deploy to Vercel

### From the Vercel dashboard

1. Push your code to **GitHub** (or GitLab / Bitbucket).
2. Go to [Vercel](https://vercel.com) → **Add New** → **Project** and import your repo.
3. **Framework Preset:** leave as detected or set to **Other**.
4. **Build Command:** (optional) `pip install -r requirements.txt`  
   **Output Directory:** leave default.  
   Vercel will detect the Flask app from `app.py`.
5. Under **Environment Variables** add:
   - **`DATABASE_URL`** = your PostgreSQL connection string (from Neon, Supabase, or Marketplace).
   - (optional) **`SECRET_KEY`** = a random string for session security.
6. Click **Deploy**. Your dashboard will be at `https://your-project.vercel.app`.

### From the CLI

```bash
npm i -g vercel
vercel login
vercel
# Set DATABASE_URL when prompted or in Project Settings → Environment Variables
vercel --prod
```

### Local dev with Postgres

```bash
set DATABASE_URL=postgresql://...
pip install -r requirements.txt
python import_data.py   # once, to load architects.json
vercel dev
# or: python app.py
```

Open `http://localhost:3000` (with `vercel dev`) or `http://127.0.0.1:5000` (with `python app.py`).

---

## 4. Connection string format

- Use **`postgresql://`** (not `postgres://`). The app will rewrite `postgres://` to `postgresql://` if needed.
- Example:  
  `postgresql://user:password@host:5432/database_name?sslmode=require`
- For serverless (Vercel), prefer a **pooled** or **direct** connection string from your provider (Neon/Supabase give both).

---

## 5. Summary

| Step   | Where     | What |
|--------|-----------|------|
| Scrape | Your PC   | `python scrape_architects.py` → `architects.json` |
| Import | Your PC   | `DATABASE_URL=... python import_data.py` → PostgreSQL |
| Deploy | Vercel    | Connect repo, set `DATABASE_URL`, deploy. Flask runs as a serverless function. |

All state (practices, leads, notes, status) lives in PostgreSQL; the app on Vercel reads and writes to it.
