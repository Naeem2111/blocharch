"""
MongoDB store for architect dashboard. Data is stored in MongoDB so the app
can be deployed to Render/Railway/etc. Scraping stays offline; import_data
pushes architects.json into this DB.
"""
import os
from datetime import datetime
from typing import List, Optional, Any

try:
    from pymongo import MongoClient, ASCENDING, DESCENDING
    from bson import ObjectId
except ImportError:
    MongoClient = None
    ObjectId = None
    ASCENDING = DESCENDING = None

# Lead pipeline statuses (same as before)
LEAD_STATUSES = [
    'new', 'contacted', 'qualified', 'proposal', 'negotiating', 'won', 'lost',
]


class _DotDict:
    """Dict that supports dot access for templates."""
    def __init__(self, d):
        d = d or {}
        if '_id' in d and not d.get('id'):
            d = dict(d)
            d['id'] = str(d['_id'])
        for k, v in d.items():
            if k == '_id':
                continue
            if isinstance(v, dict):
                setattr(self, k, _DotDict(_doc_with_id(v)))
            elif isinstance(v, list) and v and isinstance(v[0], dict):
                setattr(self, k, [_DotDict(_doc_with_id(x)) for x in v])
            else:
                setattr(self, k, v)
        if hasattr(self, '_id') and not hasattr(self, 'id'):
            self.id = str(self._id)
    def __getattr__(self, k):
        return None
    def __repr__(self):
        return repr(self.__dict__)


def get_db():
    """Get MongoDB database. Requires MONGODB_URI in env."""
    uri = os.environ.get('MONGODB_URI', '')
    if not uri:
        raise RuntimeError('Set MONGODB_URI in environment (e.g. MongoDB Atlas connection string).')
    if MongoClient is None:
        raise RuntimeError('Install pymongo: pip install pymongo')
    client = MongoClient(uri)
    # Database name from URI path (e.g. .../blocarch?...) or default
    path = uri.rstrip('/').split('/')[-1].split('?')[0]
    db_name = (path or 'blocarch') if path and '.' not in path else 'blocarch'
    return client.get_database(db_name)


# ---------- Practices ----------

def practice_count():
    return get_db().practices.count_documents({})


def practice_count_with_email():
    return get_db().practices.count_documents({'email': {'$exists': True, '$ne': None, '$ne': ''}})


def list_practices(q='', source='', staff='', page=1, per_page=25):
    coll = get_db().practices
    filt = {}
    if q:
        filt['$or'] = [
            {'name': {'$regex': q, '$options': 'i'}},
            {'contact': {'$regex': q, '$options': 'i'}},
            {'address': {'$regex': q, '$options': 'i'}},
            {'description': {'$regex': q, '$options': 'i'}},
        ]
    if source:
        filt['source'] = source
    if staff:
        filt['staff'] = staff
    total = coll.count_documents(filt)
    pages = max(1, (total + per_page - 1) // per_page)
    page = max(1, min(page, pages))
    skip = (page - 1) * per_page
    cursor = coll.find(filt).sort('name', ASCENDING).skip(skip).limit(per_page)
    items = [_DotDict(_doc_with_id(d)) for d in cursor]
    pagination = _Pagination(page=page, pages=pages, total=total, items=items, per_page=per_page)
    return pagination


def _doc_with_id(d):
    if d and '_id' in d:
        d = dict(d)
        d['id'] = str(d['_id'])
    return d


def get_practice(practice_id: str):
    """Get practice by string id (MongoDB _id)."""
    try:
        oid = ObjectId(practice_id)
    except Exception:
        return None
    doc = get_db().practices.find_one({'_id': oid})
    return _DotDict(_doc_with_id(doc)) if doc else None


def insert_practice(data: dict) -> str:
    """Insert practice; return id."""
    data = dict(data)
    data.setdefault('created_at', datetime.utcnow())
    data.setdefault('updated_at', datetime.utcnow())
    r = get_db().practices.insert_one(data)
    return str(r.inserted_id)


# ---------- Leads ----------

def lead_count_by_status():
    pipeline = [{'$group': {'_id': '$status', 'count': {'$sum': 1}}}]
    result = get_db().leads.aggregate(pipeline)
    counts = {s: 0 for s in LEAD_STATUSES}
    for row in result:
        if row['_id'] in counts:
            counts[row['_id']] = row['count']
    return counts


def ensure_lead_for_practice(practice_id: str) -> Optional[str]:
    """Ensure a lead exists for this practice; return lead id."""
    db = get_db()
    lead = db.leads.find_one({'practice_id': practice_id})
    if lead:
        return str(lead['_id'])
    lead_doc = {
        'practice_id': practice_id,
        'status': 'new',
        'score': 0,
        'notes': '',
        'tags': [],
        'next_follow_up': None,
        'created_at': datetime.utcnow(),
        'updated_at': datetime.utcnow(),
    }
    r = db.leads.insert_one(lead_doc)
    return str(r.inserted_id)


def list_leads_by_status(status: str, page=1, per_page=20):
    db = get_db()
    coll = db.leads
    filt = {'status': status}
    total = coll.count_documents(filt)
    pages = max(1, (total + per_page - 1) // per_page)
    page = max(1, min(page, pages))
    skip = (page - 1) * per_page
    cursor = coll.find(filt).sort('created_at', DESCENDING).skip(skip).limit(per_page)
    leads = []
    for doc in cursor:
        doc = _doc_with_id(doc)
        practice = db.practices.find_one({'_id': ObjectId(doc['practice_id'])})
        doc['practice'] = _doc_with_id(practice) if practice else None
        doc['practice_id'] = doc.get('practice_id')  # keep string
        leads.append(_DotDict(doc))
    pagination = _Pagination(page=page, pages=pages, total=total, items=leads, per_page=per_page)
    return pagination


def get_lead(lead_id: str):
    try:
        oid = ObjectId(lead_id)
    except Exception:
        return None
    db = get_db()
    doc = db.leads.find_one({'_id': oid})
    if not doc:
        return None
    doc = _doc_with_id(doc)
    practice = db.practices.find_one({'_id': ObjectId(doc['practice_id'])})
    doc['practice'] = _doc_with_id(practice) if practice else None
    return _DotDict(doc)


def list_leads_for_n8n(limit: int = 200, status: Optional[str] = None, with_email_only: bool = True):
    """List leads with practice data for n8n/automation. Returns plain dicts."""
    db = get_db()
    filt = {}
    if status:
        filt['status'] = status
    cursor = db.leads.find(filt).limit(limit)
    out = []
    for doc in cursor:
        practice = db.practices.find_one({'_id': ObjectId(doc['practice_id'])})
        if not practice:
            continue
        if with_email_only and not (practice.get('email') or '').strip():
            continue
        practice_id = str(practice['_id'])
        # Map pipeline status to outreach_stage for email workflow
        s = doc.get('status') or 'new'
        stage_map = {
            'new': 'cold',
            'contacted': 'no_reply',
            'qualified': 'positive_reply',
            'proposal': 'positive_reply',
            'negotiating': 'positive_reply',
            'won': 'positive_reply',
            'lost': 'negative_reply',
        }
        outreach_stage = doc.get('outreach_stage') or stage_map.get(s, 'cold')
        out.append({
            'lead_id': str(doc['_id']),
            'practice_id': practice_id,
            'status': s,
            'outreach_stage': outreach_stage,
            'practice': _doc_with_id(practice),
        })
    return out


def get_lead_by_practice_id(practice_id: str):
    doc = get_db().leads.find_one({'practice_id': practice_id})
    if not doc:
        return None
    doc = _doc_with_id(doc)
    practice = get_db().practices.find_one({'_id': ObjectId(practice_id)})
    doc['practice'] = _doc_with_id(practice) if practice else None
    return _DotDict(doc)


def update_lead(lead_id: str, **kwargs) -> Optional[dict]:
    """Update lead; return updated lead dict or None."""
    try:
        oid = ObjectId(lead_id)
    except Exception:
        return None
    db = get_db()
    updates = {}
    if 'status' in kwargs and kwargs['status'] in LEAD_STATUSES:
        updates['status'] = kwargs['status']
    if 'notes' in kwargs:
        updates['notes'] = kwargs['notes'] if kwargs['notes'] is not None else ''
    if 'score' in kwargs and isinstance(kwargs['score'], int) and 0 <= kwargs['score'] <= 100:
        updates['score'] = kwargs['score']
    if 'tags' in kwargs and isinstance(kwargs['tags'], list):
        updates['tags'] = kwargs['tags']
    if not updates:
        return get_lead(lead_id)
    updates['updated_at'] = datetime.utcnow()
    db.leads.update_one({'_id': oid}, {'$set': updates})
    return get_lead(lead_id)


# ---------- Activities ----------

def list_activities(lead_id: str, limit=20):
    try:
        oid = ObjectId(lead_id)
    except Exception:
        return []
    cursor = get_db().activities.find({'lead_id': lead_id}).sort('created_at', DESCENDING).limit(limit)
    return [_DotDict(_doc_with_id(d)) for d in cursor]


def add_activity(lead_id: str, kind: str, title: str = '', body: str = '', extra: dict = None) -> str:
    doc = {
        'lead_id': lead_id,
        'kind': kind,
        'title': title or '',
        'body': body or '',
        'extra': extra or {},
        'created_at': datetime.utcnow(),
    }
    r = get_db().activities.insert_one(doc)
    return str(r.inserted_id)


# ---------- Automation rules ----------

def list_automation_rules():
    cursor = get_db().automation_rules.find({}).sort('created_at', DESCENDING)
    return [_DotDict(_doc_with_id(d)) for d in cursor]


# ---------- Pagination helper ----------

class _Pagination:
    def __init__(self, page, pages, total, items, per_page):
        self.page = page
        self.pages = pages
        self.total = total
        self.items = items
        self.per_page = per_page
        self.has_prev = page > 1
        self.has_next = page < pages
        self.prev_num = page - 1 if page > 1 else 1
        self.next_num = page + 1 if page < pages else pages
