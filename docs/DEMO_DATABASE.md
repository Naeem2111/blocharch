# Demo database (isolated from production)

Production (`blocharch.vercel.app`) and demo (`demo.blocharch.com`) must **not** share a Postgres database.

## Layout

| Surface | Vercel project | Neon | Notes |
| --- | --- | --- | --- |
| Production | `blocharch` | Project `blocharch` → branch **`production`** → DB `neondb` | Live clients only |
| Demo | `blocharch-demo` | Same Neon project → branch **`demo`** → DB `neondb` | Copy-on-write branch + demo tour seed |

Env flags on the demo Vercel project (already set):

- `BLOCHARCH_DEMO_MODE=1`
- `NEXT_PUBLIC_BLOCHARCH_DEMO_MODE=1` (shows a “Demo environment” banner)

Local helper file (gitignored): `.env.demo` with the demo branch `DATABASE_URL`.

## Day-to-day

```bash
# List branches
neon branch list

# Connection string for the demo branch (pooled)
neon connection-string demo --pooled --database-name neondb

# Seed demo tour onto the demo branch (requires BLOCHARCH_DEMO_MODE=1)
# PowerShell: load .env.demo into the process, then:
npm run db:seed:demo

# Remove demo tour rows from whichever DATABASE_URL is active
node scripts/unseed-demo.mjs --confirm
```

`npm run db:seed:demo` **refuses** to run without `BLOCHARCH_DEMO_MODE` (unless you pass `--force`).

## After changing the demo DATABASE_URL on Vercel

Redeploy `blocharch-demo` so serverless functions pick up the new secret:

```bash
npx vercel link --yes --project blocharch-demo
npx vercel --prod
```

## Do not

- Run `db:seed:demo` against production `.env`
- Point `blocharch` (prod) `DATABASE_URL` at the Neon `demo` branch
- Rely on the unused `blocharch_demo` database name on the production branch for the live demo site (the site uses the **`demo` branch** instead)
