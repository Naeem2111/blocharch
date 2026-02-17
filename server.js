require('dotenv').config();
const path = require('path');
const express = require('express');
const {
  initSchema,
  LEAD_STATUSES,
  getPracticeCount,
  getPracticeCountWithEmail,
  getLeadCountByStatus,
  listPractices,
  getPractice,
  getLeadByPracticeId,
  ensureLead,
  listActivities,
  listLeadsByStatus,
  updateLead,
  getLeadById,
  addActivity,
  listLeadsForN8n,
  listAutomationRules,
} = require('./lib/db');

const app = express();
const PORT = process.env.PORT || 5000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.locals.LEAD_STATUSES = LEAD_STATUSES;

function paginationQuery(req) {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  return { page };
}

app.get('/', (req, res) => res.redirect('/dashboard'));

app.get('/dashboard', async (req, res, next) => {
  try {
    const [total, statusCounts, withEmail] = await Promise.all([
      getPracticeCount(),
      getLeadCountByStatus(),
      getPracticeCountWithEmail(),
    ]);
    res.render('base', {
      contentPartial: 'dashboard',
      title: 'Dashboard',
      currentPage: 'dashboard',
      total_practices: total,
      status_counts: statusCounts,
      with_email: withEmail,
      lead_statuses: LEAD_STATUSES,
    });
  } catch (e) {
    next(e);
  }
});

app.get('/practices', async (req, res, next) => {
  try {
    const q = (req.query.q || '').trim();
    const source = (req.query.source || '').trim();
    const staff = (req.query.staff || '').trim();
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pagination = await listPractices({ q, source, staff, page, perPage: 25 });
    res.render('base', {
      contentPartial: 'practices',
      title: 'Practices',
      currentPage: 'practices',
      practices: pagination.items,
      pagination,
      q,
      source,
      staff,
      lead_statuses: LEAD_STATUSES,
    });
  } catch (e) {
    next(e);
  }
});

app.get('/practices/:id', async (req, res, next) => {
  try {
    const practiceId = parseInt(req.params.id, 10);
    const practice = await getPractice(practiceId);
    if (!practice) return res.status(404).send('Practice not found');
    let lead = await getLeadByPracticeId(practiceId);
    if (!lead) {
      await ensureLead(practiceId);
      lead = await getLeadByPracticeId(practiceId);
    }
    const activities = lead ? await listActivities(lead.id, 20) : [];
    res.render('base', {
      contentPartial: 'practice_detail',
      title: practice.name || 'Practice',
      currentPage: 'practices',
      practice,
      lead,
      activities,
      lead_statuses: LEAD_STATUSES,
    });
  } catch (e) {
    next(e);
  }
});

app.get('/pipeline', async (req, res, next) => {
  try {
    let status = (req.query.status || 'new').trim();
    if (!LEAD_STATUSES.includes(status)) status = 'new';
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pagination = await listLeadsByStatus(status, page, 20);
    res.render('base', {
      contentPartial: 'pipeline',
      title: 'Pipeline',
      currentPage: 'pipeline',
      leads: pagination.items,
      pagination,
      current_status: status,
      lead_statuses: LEAD_STATUSES,
    });
  } catch (e) {
    next(e);
  }
});

app.get('/automation', async (req, res, next) => {
  try {
    const rules = await listAutomationRules();
    res.render('base', {
      contentPartial: 'automation',
      title: 'Automation',
      currentPage: 'automation',
      rules,
      lead_statuses: LEAD_STATUSES,
    });
  } catch (e) {
    next(e);
  }
});

app.get('/api/n8n/leads', async (req, res, next) => {
  try {
    const status = (req.query.status || '').trim() || null;
    const limit = Math.min(500, Math.max(1, parseInt(req.query.limit, 10) || 200));
    const leads = await listLeadsForN8n(limit, status, true);
    res.json({ leads });
  } catch (e) {
    next(e);
  }
});

app.patch('/api/leads/:id', async (req, res, next) => {
  try {
    const leadId = parseInt(req.params.id, 10);
    let lead = await getLeadById(leadId);
    if (!lead) return res.status(404).json({ error: 'Not found' });
    const data = req.body || {};
    if (data.status && LEAD_STATUSES.includes(data.status)) {
      await addActivity(leadId, { kind: 'status_change', title: `Status → ${data.status}` });
    }
    lead = await updateLead(leadId, {
      status: data.status,
      notes: data.notes,
      score: data.score,
      tags: data.tags,
    });
    res.json({
      id: lead.id,
      practice_id: lead.practice_id,
      status: lead.status,
      score: lead.score ?? 0,
      notes: lead.notes || '',
      tags: lead.tags || [],
    });
  } catch (e) {
    next(e);
  }
});

app.post('/api/leads/:id/activity', async (req, res, next) => {
  try {
    const leadId = parseInt(req.params.id, 10);
    const lead = await getLeadById(leadId);
    if (!lead) return res.status(404).json({ error: 'Not found' });
    const data = req.body || {};
    await addActivity(leadId, {
      kind: data.kind || 'note',
      title: data.title || '',
      body: data.body || '',
      metadata: data.metadata,
    });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send(
    '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Error</title></head><body>' +
    '<h1>Application error</h1><p>Set <strong>DATABASE_URL</strong> in Vercel (or .env) to your PostgreSQL connection string. See DEPLOY.md.</p></body></html>'
  );
});

async function start() {
  try {
    if (process.env.DATABASE_URL || process.env.POSTGRES_URL) {
      await initSchema();
    }
  } catch (e) {
    console.warn('DB init warning:', e.message);
  }
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server on http://0.0.0.0:${PORT}`);
  });
}

start().catch((e) => {
  console.error(e);
  process.exit(1);
});

module.exports = app;
