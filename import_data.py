"""
Import scraped architects.json into the dashboard PostgreSQL database.
Run scraping offline; then run this to push data (local or use DATABASE_URL for Vercel Postgres).
Usage: python import_data.py
Requires: DATABASE_URL or POSTGRES_URL in environment for Postgres.
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


def load_json(path='architects.json'):
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)


def run_import():
    from app import app
    from models import db, Practice, Lead

    with app.app_context():
        db.create_all()

        json_path = os.path.join(os.path.dirname(__file__), 'architects.json')
        if not os.path.exists(json_path):
            print(f"Not found: {json_path}")
            return

        data = load_json(json_path)
        existing = {p.url for p in Practice.query.all()}
        added = 0

        for row in data:
            url = (row.get('url') or '').strip()
            if not url or url in existing:
                continue

            socials = row.get('socials')
            if isinstance(socials, str):
                try:
                    socials = json.loads(socials) if socials.strip() else []
                except Exception:
                    socials = []
            if not isinstance(socials, list):
                socials = []

            practice = Practice(
                url=url,
                name=(row.get('name') or '').strip() or 'Unknown',
                website=(row.get('website') or '').strip() or None,
                socials=socials,
                email=(row.get('email') or '').strip() or None,
                address=(row.get('address') or '').strip() or None,
                contact=(row.get('contact') or '').strip() or None,
                description=(row.get('description') or '').strip() or None,
                years_active=(row.get('years_active') or '').strip() or None,
                staff=(row.get('staff') or '').strip() or None,
                awards=row.get('awards') if isinstance(row.get('awards'), list) else [],
                source=row.get('source', 'architect'),
            )
            db.session.add(practice)
            db.session.flush()
            existing.add(url)
            added += 1

            lead = Lead(practice_id=practice.id, status='new')
            db.session.add(lead)

        db.session.commit()
        total = Practice.query.count()
        print(f"Imported {added} new practices. Total practices: {total}")

        leads_created = 0
        for p in Practice.query.all():
            if Lead.query.filter_by(practice_id=p.id).first() is None:
                db.session.add(Lead(practice_id=p.id, status='new'))
                leads_created += 1
        db.session.commit()
        if leads_created:
            print(f"Created {leads_created} lead records for practices that had none.")


if __name__ == '__main__':
    run_import()
