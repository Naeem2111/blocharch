const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
const pool = connectionString
  ? new Pool({
      connectionString: connectionString.replace(/^postgres:\/\//, 'postgresql://'),
      ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: false },
    })
  : null;

const LEAD_STATUSES = [
  'new', 'contacted', 'qualified', 'proposal', 'negotiating', 'won', 'lost',
];

async function query(text, params) {
  if (!pool) throw new Error('DATABASE_URL not set');
  return pool.query(text, params);
}

async function initSchema() {
  await query(`
    CREATE TABLE IF NOT EXISTS practices (
      id SERIAL PRIMARY KEY,
      url VARCHAR(500) UNIQUE NOT NULL,
      name VARCHAR(300) NOT NULL,
      website VARCHAR(500),
      socials JSONB DEFAULT '[]',
      email VARCHAR(255),
      address TEXT,
      contact VARCHAR(255),
      description TEXT,
      years_active VARCHAR(50),
      staff VARCHAR(50),
      awards JSONB DEFAULT '[]',
      source VARCHAR(50) DEFAULT 'architect_directory',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_practices_url ON practices(url);
    CREATE INDEX IF NOT EXISTS idx_practices_name ON practices(name);
    CREATE INDEX IF NOT EXISTS idx_practices_email ON practices(email);

    CREATE TABLE IF NOT EXISTS leads (
      id SERIAL PRIMARY KEY,
      practice_id INTEGER UNIQUE NOT NULL REFERENCES practices(id),
      status VARCHAR(50) NOT NULL DEFAULT 'new',
      score INTEGER DEFAULT 0,
      notes TEXT,
      tags JSONB DEFAULT '[]',
      next_follow_up TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_leads_practice_id ON leads(practice_id);
    CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);

    CREATE TABLE IF NOT EXISTS activities (
      id SERIAL PRIMARY KEY,
      lead_id INTEGER NOT NULL REFERENCES leads(id),
      kind VARCHAR(50) NOT NULL,
      title VARCHAR(255),
      body TEXT,
      extra JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_activities_lead_id ON activities(lead_id);

    CREATE TABLE IF NOT EXISTS automation_rules (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      segment JSONB,
      action VARCHAR(100),
      action_params JSONB,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
}

async function getPracticeCount() {
  const r = await query('SELECT COUNT(*)::int AS c FROM practices');
  return r.rows[0]?.c ?? 0;
}

async function getPracticeCountWithEmail() {
  const r = await query(
    "SELECT COUNT(*)::int AS c FROM practices WHERE email IS NOT NULL AND email != ''"
  );
  return r.rows[0]?.c ?? 0;
}

async function getLeadCountByStatus() {
  const r = await query(
    'SELECT status, COUNT(*)::int AS c FROM leads GROUP BY status'
  );
  const counts = Object.fromEntries(LEAD_STATUSES.map((s) => [s, 0]));
  r.rows.forEach((row) => { counts[row.status] = row.c; });
  return counts;
}

async function listPractices({ q = '', source = '', staff = '', page = 1, perPage = 25 } = {}) {
  const conditions = [];
  const params = [];
  let i = 1;
  if (q) {
    conditions.push(`(name ILIKE $${i} OR contact ILIKE $${i} OR address ILIKE $${i} OR description ILIKE $${i})`);
    params.push(`%${q}%`);
    i++;
  }
  if (source) {
    conditions.push(`source = $${i}`);
    params.push(source);
    i++;
  }
  if (staff) {
    conditions.push(`staff = $${i}`);
    params.push(staff);
    i++;
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const countR = await query(`SELECT COUNT(*)::int AS c FROM practices ${where}`, params);
  const total = countR.rows[0]?.c ?? 0;
  const pages = Math.max(1, Math.ceil(total / perPage));
  const pageNum = Math.max(1, Math.min(page, pages));
  const offset = (pageNum - 1) * perPage;
  params.push(perPage, offset);
  const limitIdx = params.length - 1;
  const offsetIdx = params.length;
  const data = await query(
    `SELECT * FROM practices ${where} ORDER BY name LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    params
  );
  return {
    items: data.rows,
    page: pageNum,
    pages,
    total,
    perPage,
    has_prev: pageNum > 1,
    has_next: pageNum < pages,
    prev_num: pageNum - 1,
    next_num: pageNum + 1,
  };
}

async function getPractice(id) {
  const r = await query('SELECT * FROM practices WHERE id = $1', [id]);
  return r.rows[0] || null;
}

async function getLeadByPracticeId(practiceId) {
  const r = await query(
    'SELECT l.*, row_to_json(p.*) AS practice FROM leads l JOIN practices p ON p.id = l.practice_id WHERE l.practice_id = $1',
    [practiceId]
  );
  const row = r.rows[0];
  if (!row) return null;
  const { practice, ...lead } = row;
  lead.practice = practice && practice.id ? practice : null;
  return lead;
}

async function ensureLead(practiceId) {
  let r = await query('SELECT id FROM leads WHERE practice_id = $1', [practiceId]);
  if (r.rows[0]) return r.rows[0].id;
  r = await query('INSERT INTO leads (practice_id, status) VALUES ($1, $2) RETURNING id', [
    practiceId,
    'new',
  ]);
  return r.rows[0].id;
}

async function listActivities(leadId, limit = 20) {
  const r = await query(
    'SELECT * FROM activities WHERE lead_id = $1 ORDER BY created_at DESC LIMIT $2',
    [leadId, limit]
  );
  return r.rows;
}

async function listLeadsByStatus(status, page = 1, perPage = 20) {
  const countR = await query(
    'SELECT COUNT(*)::int AS c FROM leads l JOIN practices p ON p.id = l.practice_id WHERE l.status = $1',
    [status]
  );
  const total = countR.rows[0]?.c ?? 0;
  const pages = Math.max(1, Math.ceil(total / perPage));
  const pageNum = Math.max(1, Math.min(page, pages));
  const offset = (pageNum - 1) * perPage;
  const data = await query(
    `SELECT l.*, row_to_json(p.*) AS practice FROM leads l JOIN practices p ON p.id = l.practice_id
     WHERE l.status = $1 ORDER BY p.name LIMIT $2 OFFSET $3`,
    [status, perPage, offset]
  );
  const items = data.rows.map((row) => {
    const { practice, ...lead } = row;
    lead.practice = practice && practice.id ? practice : null;
    return lead;
  });
  return {
    items,
    page: pageNum,
    pages,
    total,
    has_prev: pageNum > 1,
    has_next: pageNum < pages,
    prev_num: pageNum - 1,
    next_num: pageNum + 1,
  };
}

async function updateLead(leadId, { status, notes, score, tags }) {
  const updates = [];
  const params = [];
  let i = 1;
  if (status && LEAD_STATUSES.includes(status)) {
    updates.push(`status = $${i++}`);
    params.push(status);
  }
  if (notes !== undefined) {
    updates.push(`notes = $${i++}`);
    params.push(notes);
  }
  if (typeof score === 'number' && score >= 0 && score <= 100) {
    updates.push(`score = $${i++}`);
    params.push(score);
  }
  if (Array.isArray(tags)) {
    updates.push(`tags = $${i++}`);
    params.push(JSON.stringify(tags));
  }
  if (updates.length === 0) return getLeadById(leadId);
  updates.push('updated_at = NOW()');
  params.push(leadId);
  await query(
    `UPDATE leads SET ${updates.join(', ')} WHERE id = $${i}`,
    params
  );
  return getLeadById(leadId);
}

async function getLeadById(leadId) {
  const r = await query(
    'SELECT l.*, row_to_json(p.*) AS practice FROM leads l JOIN practices p ON p.id = l.practice_id WHERE l.id = $1',
    [leadId]
  );
  const row = r.rows[0];
  if (!row) return null;
  const { practice, ...lead } = row;
  lead.practice = practice && practice.id ? practice : null;
  return lead;
}

async function addActivity(leadId, { kind = 'note', title = '', body = '', metadata = {} } = {}) {
  const r = await query(
    'INSERT INTO activities (lead_id, kind, title, body, extra) VALUES ($1, $2, $3, $4, $5) RETURNING *',
    [leadId, kind, title, body, JSON.stringify(metadata)]
  );
  return r.rows[0];
}

async function listLeadsForN8n(limit = 200, status = null, withEmailOnly = true) {
  let sql = `
    SELECT l.id AS lead_id, p.id AS practice_id, l.status,
           row_to_json(p.*) AS practice
    FROM leads l JOIN practices p ON p.id = l.practice_id
  `;
  const params = [];
  const where = [];
  let i = 1;
  if (status) {
    where.push(`l.status = $${i++}`);
    params.push(status);
  }
  if (withEmailOnly) {
    where.push("p.email IS NOT NULL AND p.email != ''");
  }
  if (where.length) sql += ` WHERE ${where.join(' AND ')}`;
  sql += ` ORDER BY l.id LIMIT $${i}`;
  params.push(limit);
  const r = await query(sql, params);
  const stageMap = {
    new: 'cold', contacted: 'no_reply', qualified: 'positive_reply',
    proposal: 'positive_reply', negotiating: 'positive_reply', won: 'positive_reply',
    lost: 'negative_reply',
  };
  return r.rows.map((row) => ({
    lead_id: row.lead_id,
    practice_id: row.practice_id,
    status: row.status,
    outreach_stage: stageMap[row.status] || 'cold',
    practice: row.practice && row.practice.id
      ? {
          id: row.practice.id,
          name: row.practice.name || '',
          email: row.practice.email || '',
          contact: row.practice.contact || '',
          website: row.practice.website || '',
          address: row.practice.address || '',
        }
      : null,
  }));
}

async function listAutomationRules() {
  const r = await query('SELECT * FROM automation_rules ORDER BY created_at DESC');
  return r.rows;
}

async function upsertPractice(record) {
  const r = await query(
    `INSERT INTO practices (url, name, website, socials, email, address, contact, description, years_active, staff, awards, source, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
     ON CONFLICT (url) DO UPDATE SET
       name = EXCLUDED.name, website = EXCLUDED.website, socials = EXCLUDED.socials,
       email = EXCLUDED.email, address = EXCLUDED.address, contact = EXCLUDED.contact,
       description = EXCLUDED.description, years_active = EXCLUDED.years_active,
       staff = EXCLUDED.staff, awards = EXCLUDED.awards, source = EXCLUDED.source,
       updated_at = NOW()
     RETURNING id`,
    [
      record.url,
      record.name || '',
      record.website || null,
      JSON.stringify(record.socials || []),
      record.email || null,
      record.address || null,
      record.contact || null,
      record.description || null,
      record.years_active || null,
      record.staff || null,
      JSON.stringify(record.awards || []),
      record.source || 'architect_directory',
    ]
  );
  return r.rows[0].id;
}

module.exports = {
  pool,
  query,
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
  upsertPractice,
};
