"""
Architect Lead Dashboard – nurture and generate leads with automation.
Uses PostgreSQL (set DATABASE_URL). Scrape offline; import architects.json into Postgres.
Deploy to Vercel with a Postgres database.
"""
import os
from flask import Flask, render_template, request, jsonify, redirect, url_for, abort

from sqlalchemy import or_, func
from models import db, Practice, Lead, Activity, AutomationRule, LEAD_STATUSES


def list_leads_for_n8n(limit=200, status=None, with_email_only=True):
    """Leads with practice data for n8n; same JSON shape as before."""
    stage_map = {
        'new': 'cold', 'contacted': 'no_reply', 'qualified': 'positive_reply',
        'proposal': 'positive_reply', 'negotiating': 'positive_reply',
        'won': 'positive_reply', 'lost': 'negative_reply',
    }
    q = Lead.query.join(Practice)
    if status:
        q = q.filter(Lead.status == status)
    if with_email_only:
        q = q.filter(Practice.email != None, Practice.email != '')
    leads = q.limit(limit).all()
    out = []
    for lead in leads:
        p = lead.practice
        if not p:
            continue
        out.append({
            'lead_id': lead.id,
            'practice_id': p.id,
            'status': lead.status or 'new',
            'outreach_stage': stage_map.get(lead.status or 'new', 'cold'),
            'practice': {
                'id': p.id,
                'name': p.name or '',
                'email': p.email or '',
                'contact': p.contact or '',
                'website': p.website or '',
                'address': p.address or '',
            },
        })
    return out


def create_app():
    app = Flask(__name__)
    app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-secret-change-in-production')
    # PostgreSQL: Vercel Postgres, Neon, Supabase, or any postgresql:// URL
    app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get(
        'DATABASE_URL',
        os.environ.get('POSTGRES_URL', 'sqlite:///architect_leads.db')
    )
    if app.config['SQLALCHEMY_DATABASE_URI'].startswith('postgres://'):
        app.config['SQLALCHEMY_DATABASE_URI'] = app.config['SQLALCHEMY_DATABASE_URI'].replace(
            'postgres://', 'postgresql://', 1
        )
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
        'pool_pre_ping': True,
        'pool_recycle': 300,
        'connect_args': {} if 'sqlite' in app.config['SQLALCHEMY_DATABASE_URI'] else {'connect_timeout': 10},
    }
    db.init_app(app)

    with app.app_context():
        db.create_all()

    @app.cli.command('create-db')
    def create_db():
        db.create_all()
        print('Database tables created.')

    # ---------- Dashboard pages ----------
    @app.route('/')
    def index():
        return redirect(url_for('dashboard'))

    @app.route('/dashboard')
    def dashboard():
        total = Practice.query.count()
        by_status = db.session.query(Lead.status, func.count(Lead.id)).group_by(Lead.status).all()
        status_counts = {s: 0 for s in LEAD_STATUSES}
        for s, c in by_status:
            status_counts[s] = c
        with_email = Practice.query.filter(Practice.email != None, Practice.email != '').count()
        return render_template(
            'dashboard.html',
            total_practices=total or 0,
            status_counts=status_counts,
            with_email=with_email or 0,
            lead_statuses=LEAD_STATUSES,
        )

    @app.route('/practices')
    def practices_list():
        q = (request.args.get('q') or '').strip()
        source = (request.args.get('source') or '').strip()
        staff = (request.args.get('staff') or '').strip()
        page = max(1, request.args.get('page', 1, type=int))
        per_page = 25

        query = Practice.query
        if q:
            query = query.filter(
                or_(
                    Practice.name.ilike(f'%{q}%'),
                    Practice.contact.ilike(f'%{q}%'),
                    Practice.address.ilike(f'%{q}%'),
                    Practice.description.ilike(f'%{q}%'),
                )
            )
        if source:
            query = query.filter(Practice.source == source)
        if staff:
            query = query.filter(Practice.staff == staff)

        pagination = query.order_by(Practice.name).paginate(page=page, per_page=per_page)
        return render_template(
            'practices.html',
            practices=pagination.items,
            pagination=pagination,
            q=q or '',
            source=source or '',
            staff=staff or '',
        )

    @app.route('/practices/<int:practice_id>')
    def practice_detail(practice_id):
        practice = Practice.query.get_or_404(practice_id)
        lead = Lead.query.filter_by(practice_id=practice_id).first()
        if lead is None:
            lead = Lead(practice_id=practice.id, status='new')
            db.session.add(lead)
            db.session.commit()
        activities = Activity.query.filter_by(lead_id=lead.id).order_by(Activity.created_at.desc()).limit(20).all()
        return render_template(
            'practice_detail.html',
            practice=practice,
            lead=lead,
            activities=activities,
            lead_statuses=LEAD_STATUSES,
        )

    @app.route('/pipeline')
    def pipeline():
        status = request.args.get('status', 'new')
        if status not in LEAD_STATUSES:
            status = 'new'
        page = max(1, request.args.get('page', 1, type=int))
        per_page = 20

        query = Lead.query.filter_by(status=status).join(Practice).order_by(Practice.name)
        pagination = query.paginate(page=page, per_page=per_page)
        return render_template(
            'pipeline.html',
            leads=pagination.items,
            pagination=pagination,
            current_status=status,
            lead_statuses=LEAD_STATUSES,
        )

    @app.route('/automation')
    def automation():
        rules = AutomationRule.query.order_by(AutomationRule.created_at.desc()).all()
        return render_template('automation.html', rules=rules)

    # ---------- API for n8n / automation ----------
    @app.route('/api/n8n/leads')
    def api_n8n_leads():
        status = (request.args.get('status') or '').strip() or None
        limit = min(500, max(1, request.args.get('limit', 200, type=int)))
        leads = list_leads_for_n8n(limit=limit, status=status, with_email_only=True)
        return jsonify({'leads': leads})

    # ---------- API for updates ----------
    @app.route('/api/leads/<int:lead_id>', methods=['PATCH'])
    def api_update_lead(lead_id):
        lead = Lead.query.get_or_404(lead_id)
        data = request.get_json() or {}
        if 'status' in data and data['status'] in LEAD_STATUSES:
            lead.status = data['status']
            db.session.add(Activity(lead_id=lead.id, kind='status_change', title=f"Status → {data['status']}", body=''))
        if 'notes' in data:
            lead.notes = data['notes'] if data['notes'] is not None else ''
        if 'score' in data and isinstance(data['score'], int) and 0 <= data['score'] <= 100:
            lead.score = data['score']
        if 'tags' in data and isinstance(data['tags'], list):
            lead.tags = data['tags']
        db.session.commit()
        return jsonify(lead.to_dict())

    @app.route('/api/leads/<int:lead_id>/activity', methods=['POST'])
    def api_add_activity(lead_id):
        lead = Lead.query.get_or_404(lead_id)
        data = request.get_json() or {}
        kind = data.get('kind', 'note')
        title = data.get('title', '')
        body = data.get('body', '')
        activity = Activity(lead_id=lead_id, kind=kind, title=title, body=body, extra=data.get('metadata'))
        db.session.add(activity)
        db.session.commit()
        return jsonify(activity.to_dict())

    return app


app = create_app()

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', debug=os.environ.get('FLASK_DEBUG') == '1', port=port)
