# Blocarch

Architect directory scraper and dashboard. The dashboard runs on Next.js with a Postgres database via Prisma.

## Scraper (Python)

Scrapes architect and landscape architect practices from [architectdirectory.co.uk](https://architectdirectory.co.uk/).

### Install

```bash
pip install -r requirements.txt
```

### Run

```bash
python scrape_architects.py
```

Output: `architects.json` and `architects.csv`.

## Dashboard (Next.js)

### Install

```bash
npm install
```

### Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Login

- **Username:** blocharch  
- **Password:** blocharch  

### Data

The app stores architects, leads, and users in Postgres (`DATABASE_URL`).
If you already have local JSON data, run:

```bash
npm run db:push
npm run db:seed
```

### Lead nurturing

- **Pipeline stages (6):** cold, no_reply, positive_reply, follow_up_interested, negative_reply, follow_up_not_interested
- **Rating:** 1–5 stars per firm
- **Email templates:** Use Introduction / Follow-up (or add your own via API)
- **Activate workflow:** Sends leads to n8n if `N8N_WEBHOOK_URL` is set in `.env`

Lead state is stored in `data/leads.json`.

### n8n workflow

See **N8N-SETUP.md** for local setup. Quick start:

```bash
npm run n8n              # run n8n with npx
# or
npm run n8n:docker       # run n8n in Docker
```

Import `n8n-lead-outreach-workflow.json` in n8n, set `DASHBOARD_URL` and SMTP credentials.

### Maps

- **All practices map:** `/dashboard/map`
- **Practice detail map:** shown on each practice with an address

Geocoding uses OpenStreetMap Nominatim and caches results to `data/geocache.json`.

### Scripts

| Command      | Description                    |
|-------------|--------------------------------|
| `npm run dev` | Start dev server               |
| `npm run build` | Production build              |
| `npm run start` | Start production server       |
| `npm run scrape` | Run Python scraper           |
