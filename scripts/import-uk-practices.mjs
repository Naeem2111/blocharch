/**
 * Upsert UK interior designers and development companies scraped from
 * BIID and HomeViews. Does not delete existing architect-directory rows.
 *
 * Usage: node scripts/import-uk-practices.mjs --confirm
 */
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const root = process.cwd();
const prisma = new PrismaClient();

function loadEnvFile() {
  try {
    const raw = fs.readFileSync(path.join(root, ".env"), "utf8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const index = trimmed.indexOf("=");
      if (index === -1) continue;
      const key = trimmed.slice(0, index).trim();
      let value = trimmed.slice(index + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = value;
    }
  } catch {
    /* no .env */
  }
}

function readRows(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const rows = JSON.parse(fs.readFileSync(filePath, "utf8"));
  return Array.isArray(rows) ? rows : [];
}

function toArchitect(item) {
  const url = String(item?.url || "").trim();
  const name = String(item?.name || "").trim();
  if (!url || !name || item?.skipped) return null;
  const practiceType = ["interior_design", "development"].includes(String(item.practice_type || ""))
    ? String(item.practice_type)
    : null;
  if (!practiceType) return null;
  return {
    url,
    name,
    practiceType,
    website: item.website ? String(item.website) : null,
    socials: Array.isArray(item.socials) ? item.socials.map(String).filter(Boolean) : [],
    email: item.email ? String(item.email) : null,
    address: item.address ? String(item.address) : null,
    contact: item.contact ? String(item.contact) : null,
    description: item.description ? String(item.description) : null,
    yearsActive: item.years_active ? String(item.years_active) : null,
    staff: item.staff ? String(item.staff) : null,
    awards: Array.isArray(item.awards) ? item.awards.map(String) : [],
  };
}

function mergeArchitectsJson(records) {
  const filePath = path.join(root, "architects.json");
  const existing = fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, "utf8")) : [];
  const byUrl = new Map();
  for (const item of Array.isArray(existing) ? existing : []) {
    if (item?.url) byUrl.set(item.url, item);
  }
  for (const record of records) {
    byUrl.set(record.url, {
      url: record.url,
      name: record.name,
      practice_type: record.practiceType,
      website: record.website || "",
      socials: record.socials,
      email: record.email || "",
      address: record.address || "",
      contact: record.contact || "",
      description: record.description || "",
      years_active: record.yearsActive || "",
      staff: record.staff || "",
      awards: record.awards,
    });
  }
  const merged = Array.from(byUrl.values());
  fs.writeFileSync(filePath, JSON.stringify(merged, null, 2) + "\n", "utf8");
  return merged.length;
}

async function main() {
  if (!process.argv.includes("--confirm")) {
    console.error("Refusing without --confirm");
    process.exit(1);
  }
  loadEnvFile();
  const files = [
    path.join(root, "data", "uk-interior-designers.json"),
    path.join(root, "data", "uk-development-companies.json"),
  ];
  const records = files.flatMap(readRows).map(toArchitect).filter(Boolean);
  console.log(`Importing ${records.length} practices…`);

  let upserts = 0;
  for (const record of records) {
    await prisma.architect.upsert({
      where: { url: record.url },
      create: record,
      update: record,
    });
    upserts += 1;
    if (upserts % 100 === 0) console.log(`  upserted ${upserts}`);
  }

  const urls = records.map((record) => record.url);
  const existingLeads = new Set(
    (
      await prisma.lead.findMany({
        where: { architectUrl: { in: urls } },
        select: { architectUrl: true },
      })
    ).map((lead) => lead.architectUrl),
  );
  const missing = urls.filter((url) => !existingLeads.has(url)).map((architectUrl) => ({
    architectUrl,
    stage: "cold",
    rating: 0,
  }));
  if (missing.length) {
    await prisma.lead.createMany({ data: missing, skipDuplicates: true });
  }

  const merged = mergeArchitectsJson(records);
  const counts = await prisma.architect.groupBy({
    by: ["practiceType"],
    _count: { _all: true },
    where: { deletedAt: null },
  });
  console.log(`Upserted ${upserts}. New cold leads: ${missing.length}. architects.json rows: ${merged}.`);
  console.log(counts.map((row) => `${row.practiceType}=${row._count._all}`).join(", "));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
