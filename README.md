# Blocarch

Architect directory scraper and dashboard. Data lives in `architects.json`; the dashboard is a Next.js app with login.

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

The dashboard reads directly from `architects.json` in the project root. Run the scraper to populate or update it.

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

### Scripts

| Command      | Description                    |
|-------------|--------------------------------|
| `npm run dev` | Start dev server               |
| `npm run build` | Production build              |
| `npm run start` | Start production server       |
| `npm run scrape` | Run Python scraper           |
