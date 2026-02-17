"""
Database models for architect lead dashboard.
"""
from datetime import datetime
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import Text, Integer, String, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship

db = SQLAlchemy()

# Lead pipeline statuses
LEAD_STATUSES = [
    'new',           # Just in directory, not contacted
    'contacted',     # Initial outreach done
    'qualified',     # Fit confirmed, interested
    'proposal',      # Proposal sent
    'negotiating',   # In discussion
    'won',           # Converted to client/partner
    'lost',          # Not pursuing
]


class Practice(db.Model):
    """Scraped architect/landscape practice from the directory."""
    __tablename__ = 'practices'

    id = db.Column(Integer, primary_key=True)
    url = db.Column(String(500), unique=True, nullable=False, index=True)
    name = db.Column(String(300), nullable=False, index=True)
    website = db.Column(String(500))
    socials = db.Column(JSON)  # list of social profile URLs (Twitter, Instagram, etc.)
    email = db.Column(String(255), index=True)
    address = db.Column(Text)
    contact = db.Column(String(255))
    description = db.Column(Text)
    years_active = db.Column(String(50))
    staff = db.Column(String(50))  # e.g. "0 - 4", "5 - 19"
    awards = db.Column(JSON)  # list of award names
    source = db.Column(String(50), default='architect_directory')  # architect | landscape
    created_at = db.Column(DateTime, default=datetime.utcnow)
    updated_at = db.Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationship to lead (one practice can have one lead record)
    lead = relationship('Lead', back_populates='practice', uselist=False)

    def to_dict(self):
        return {
            'id': self.id,
            'url': self.url or '',
            'name': self.name or '',
            'website': self.website or '',
            'socials': self.socials if isinstance(self.socials, list) else [],
            'email': self.email or '',
            'address': self.address or '',
            'contact': self.contact or '',
            'description': (self.description or '')[:500],
            'years_active': self.years_active or '',
            'staff': self.staff or '',
            'awards': self.awards or [],
            'source': self.source or '',
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class Lead(db.Model):
    """Lead / pipeline record for a practice (nurturing, status, notes)."""
    __tablename__ = 'leads'

    id = db.Column(Integer, primary_key=True)
    practice_id = db.Column(Integer, ForeignKey('practices.id'), unique=True, nullable=False, index=True)
    status = db.Column(String(50), default='new', nullable=False, index=True)  # from LEAD_STATUSES
    score = db.Column(Integer, default=0)  # 0-100 lead score
    notes = db.Column(Text)
    tags = db.Column(JSON)  # e.g. ["housing", "london", "large practice"]
    next_follow_up = db.Column(DateTime)
    created_at = db.Column(DateTime, default=datetime.utcnow)
    updated_at = db.Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    practice = relationship('Practice', back_populates='lead')
    activities = relationship('Activity', back_populates='lead', order_by='Activity.created_at.desc()')

    def to_dict(self):
        return {
            'id': self.id,
            'practice_id': self.practice_id,
            'practice': self.practice.to_dict() if self.practice else None,
            'status': self.status or 'new',
            'score': self.score if self.score is not None else 0,
            'notes': self.notes or '',
            'tags': self.tags or [],
            'next_follow_up': self.next_follow_up.isoformat() if self.next_follow_up else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }


class Activity(db.Model):
    """Activity log for a lead (emails, calls, notes, status changes)."""
    __tablename__ = 'activities'

    id = db.Column(Integer, primary_key=True)
    lead_id = db.Column(Integer, ForeignKey('leads.id'), nullable=False, index=True)
    kind = db.Column(String(50), nullable=False)  # email_sent, call, note, status_change
    title = db.Column(String(255))
    body = db.Column(Text)
    extra = db.Column(JSON)  # extra data (e.g. email subject, call duration)
    created_at = db.Column(DateTime, default=datetime.utcnow)

    lead = relationship('Lead', back_populates='activities')

    def to_dict(self):
        return {
            'id': self.id,
            'lead_id': self.lead_id,
            'kind': self.kind or 'note',
            'title': self.title or '',
            'body': self.body or '',
            'metadata': self.extra or {},
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class AutomationRule(db.Model):
    """Placeholder for automation rules (e.g. segment + action)."""
    __tablename__ = 'automation_rules'

    id = db.Column(Integer, primary_key=True)
    name = db.Column(String(255), nullable=False)
    description = db.Column(Text)
    segment = db.Column(JSON)  # e.g. {"staff": "5 - 19", "location": "London"}
    action = db.Column(String(100))  # e.g. add_tag, set_follow_up
    action_params = db.Column(JSON)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(DateTime, default=datetime.utcnow)
    updated_at = db.Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
