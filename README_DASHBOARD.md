# Architect Lead Dashboard

A tailored dashboard for architect firms to **nurture and generate leads** from the scraped [Architect Directory](https://architectdirectory.co.uk/) data, with pipeline stages and automation placeholders.

## Features

- **Dashboard** – Overview: total practices, with email, new leads, contacted; pipeline funnel by stage.
- **Practices** – Search and filter all practices (name, contact, address, source, staff size). Open any practice to view details and update lead status/notes.
- **Pipeline** – View leads by stage: New → Contacted → Qualified → Proposal → Negotiating → Won / Lost. Change status from each practice page.
- **Practice detail** – Full contact info, description, lead notes, status dropdown (saved via API), and activity log.
- **Automation** – Placeholder page for future rules (segment + action, follow-up scheduling).

## Setup

1. **Install dependencies**

   ```bash
   pip install -r requirements.txt
   ```

2. **Create the database**

   ```bash
   flask create-db
   ```

   Or run the app once; tables are created on first request if you add `db.create_all()` in a before_first_request (currently you need to run the CLI command or import script which calls `db.create_all()`).

3. **Import scraped data**

   ```bash
   python import_data.py
   ```

   This reads `architects.json` and creates one **Practice** per row and one **Lead** per practice (status `new`).

4. **Run the dashboard**

   ```bash
   python app.py
   ```

   Or: `flask run` (with `FLASK_APP=app.py` or `FLASK_APP=app:app`).

   Open **http://127.0.0.1:5000** in your browser.

## Database

- **SQLite** by default: `architect_leads.db` in the project root.
- Set `DATABASE_URI` to use PostgreSQL or another DB.

### Tables

- **practices** – Directory data (name, url, website, email, address, contact, description, years_active, staff, awards, source).
- **leads** – One per practice: status, score, notes, tags, next_follow_up.
- **activities** – Log of status changes and notes per lead.
- **automation_rules** – Stored rules (segment + action) for future automation.

## API

- `PATCH /api/leads/<id>` – Update lead: `status`, `notes`, `score`, `tags` (JSON body).
- `POST /api/leads/<id>/activity` – Add activity: `kind`, `title`, `body`, optional `metadata` (JSON).

## Automation (planned)

- Segment by staff size, location, tags.
- Auto-tag new practices matching criteria.
- Schedule “next follow-up” for contacted leads.
- Export segments for email campaigns.
