/**
 * Load practices from architects.json into PostgreSQL and ensure one lead per practice.
 * Run: DATABASE_URL=postgresql://... node scripts/populate-db.js
 * Or: npm run populate-db (with .env or env set)
 */
require('dotenv').config();
const path = require('path');
const fs = require('fs');
const {
  initSchema,
  upsertPractice,
  ensureLead,
} = require('../lib/db');

const JSON_PATH = path.join(__dirname, '..', 'architects.json');

async function main() {
  if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL) {
    console.error('Set DATABASE_URL or POSTGRES_URL');
    process.exit(1);
  }
  if (!fs.existsSync(JSON_PATH)) {
    console.error('architects.json not found. Run the Python scraper first: python scrape_architects.py');
    process.exit(1);
  }
  const raw = fs.readFileSync(JSON_PATH, 'utf8');
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    console.error('Invalid JSON in architects.json:', e.message);
    process.exit(1);
  }
  if (!Array.isArray(data)) {
    console.error('architects.json must be an array of practice objects');
    process.exit(1);
  }

  await initSchema();
  console.log('Loaded', data.length, 'practices from architects.json');
  for (let i = 0; i < data.length; i++) {
    const record = data[i];
    if (!record || !record.url) {
      console.warn('Skipping row', i + 1, '- missing url');
      continue;
    }
    const id = await upsertPractice(record);
    await ensureLead(id);
    if (i > 0 && i % 500 === 0) console.log('Processed', i, '...');
  }
  console.log('Done. Practices and leads are in sync.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
