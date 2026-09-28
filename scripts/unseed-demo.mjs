/**
 * Remove the demo-tour seed from a live database without touching real clients.
 *
 * Safe keepers: Icon Architects, HOUSE NAEEM, SIMON & MEGHAN, admin users.
 *
 *   node scripts/unseed-demo.mjs --confirm
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEMO_USERNAMES = ["manager01", "sales01", "athlete01", "athlete02"];
const DEMO_ATHLETE_CODES = ["ATH-D1", "ATH-D2"];
const DEMO_OPS_SLUGS = ["harbour-studio", "wright-cole"];
const DEMO_PRIVATE_SLUG = "kloof-house";
const DEMO_LEAD_NOTE = "Demo tour sample outreach.";
const DEMO_PROJECT_BOARD_TITLES = [
  "14 Narrow Street warehouse",
  "9 Cable Street loft",
  "22 Wapping High Street",
  "The Coach House, Richmond",
];

async function main() {
  if (!process.argv.includes("--confirm")) {
    console.error("Refusing to run without --confirm");
    console.error("Example: node scripts/unseed-demo.mjs --confirm");
    process.exit(1);
  }

  const counts = {};
  const del = async (key, fn) => {
    const result = await fn();
    counts[key] = result?.count ?? result ?? 0;
    console.log(`  ${key}: ${counts[key]}`);
  };

  const demoUsers = await prisma.user.findMany({
    where: { username: { in: DEMO_USERNAMES } },
    select: { id: true, username: true },
  });
  const demoAthletes = await prisma.opsAthlete.findMany({
    where: {
      OR: [
        { athleteCode: { in: DEMO_ATHLETE_CODES } },
        { userId: { in: demoUsers.map((u) => u.id) } },
      ],
    },
    select: { id: true, userId: true, fullName: true, athleteCode: true },
  });
  const athleteIds = demoAthletes.map((a) => a.id);
  const userIds = [...new Set([...demoUsers.map((u) => u.id), ...demoAthletes.map((a) => a.userId)])];

  console.log("Removing demo-tour records…");
  if (demoUsers.length) {
    console.log("  users:", demoUsers.map((u) => u.username).join(", "));
  }
  if (demoAthletes.length) {
    console.log("  athletes:", demoAthletes.map((a) => `${a.fullName} (${a.athleteCode})`).join(", "));
  }

  const demoLeads = await prisma.lead.findMany({
    where: { notes: DEMO_LEAD_NOTE },
    select: { id: true },
  });
  const demoLeadIds = demoLeads.map((l) => l.id);

  await del("demoOutreachLogs", () =>
    prisma.leadOutreachLog.deleteMany({
      where: {
        OR: [
          { leadId: { in: demoLeadIds } },
          { messageBody: { contains: "Demo outreach log" } },
        ],
      },
    }),
  );
  await del("demoLeadReset", async () => {
    if (demoLeadIds.length === 0) return { count: 0 };
    return prisma.lead.updateMany({
      where: { id: { in: demoLeadIds } },
      data: {
        stage: "cold",
        touchCount: 0,
        lastContactedAt: null,
        lastEmailedAt: null,
        lastCommunicationType: null,
        followUpDueAt: null,
        nextAction: null,
        notes: null,
      },
    });
  });

  await del("demoPrivateClients", () =>
    prisma.privateClient.deleteMany({
      where: {
        slug: DEMO_PRIVATE_SLUG,
        notes: { contains: "Demo Cape Town" },
      },
    }),
  );

  await del("demoOpsClients", () =>
    prisma.opsClient.deleteMany({
      where: {
        OR: [
          { slug: { in: DEMO_OPS_SLUGS } },
          { name: { in: ["Harbour Studio", "Wright & Cole"] } },
        ],
      },
    }),
  );

  await del("demoProjectBoards", () =>
    prisma.plannerBoard.deleteMany({
      where: { title: { in: DEMO_PROJECT_BOARD_TITLES }, kind: "project" },
    }),
  );

  await del("demoNotifications", () =>
    prisma.opsNotification.deleteMany({
      where: {
        OR: [
          { title: { in: ["Check-in requested — Narrow Street", "Tender pack waiting on feedback"] } },
          athleteIds.length ? { athleteId: { in: athleteIds } } : undefined,
        ].filter(Boolean),
      },
    }),
  );

  const unusedPhase = await prisma.opsCatalogPhase.findFirst({
    where: { label: "BIM coordination pack", builtInKey: null },
    select: { id: true, _count: { select: { projects: true, lineItems: true } } },
  });
  if (unusedPhase && unusedPhase._count.projects === 0 && unusedPhase._count.lineItems === 0) {
    await del("demoCatalogPhase", () => prisma.opsCatalogPhase.deleteMany({ where: { id: unusedPhase.id } }));
  } else {
    counts.demoCatalogPhase = 0;
    console.log("  demoCatalogPhase: 0");
  }

  const unusedWork = await prisma.opsCatalogWorkType.findFirst({
    where: { label: "Clash detection", builtInKey: null },
    select: { id: true },
  });
  if (unusedWork) {
    const inUse = await prisma.opsSubmissionLineItem.count({
      where: { taskTypes: { has: `custom:${unusedWork.id}` } },
    });
    if (inUse === 0) {
      await del("demoCatalogWorkType", () =>
        prisma.opsCatalogWorkType.deleteMany({ where: { id: unusedWork.id } }),
      );
    } else {
      counts.demoCatalogWorkType = 0;
      console.log("  demoCatalogWorkType: 0 (in use)");
    }
  } else {
    counts.demoCatalogWorkType = 0;
    console.log("  demoCatalogWorkType: 0");
  }

  await del("demoSetting", () => prisma.opsAppSetting.deleteMany({ where: { key: "demo_tour_seed" } }));

  if (userIds.length > 0) {
    await del("demoUsers", () => prisma.user.deleteMany({ where: { id: { in: userIds } } }));
  } else {
    counts.demoUsers = 0;
    console.log("  demoUsers: 0");
  }

  const remaining = {
    icon: await prisma.opsClient.findUnique({ where: { slug: "icon" }, select: { name: true } }),
    houseNaeem: await prisma.privateClient.findUnique({
      where: { slug: "house-naeem" },
      select: { name: true },
    }),
    simonMeghan: await prisma.privateClient.findUnique({
      where: { slug: "simon-meghan" },
      select: { name: true },
    }),
    demoUsersLeft: await prisma.user.count({ where: { username: { in: DEMO_USERNAMES } } }),
    demoPrivateLeft: await prisma.privateClient.count({ where: { slug: DEMO_PRIVATE_SLUG } }),
    demoLeadNotesLeft: await prisma.lead.count({ where: { notes: DEMO_LEAD_NOTE } }),
  };

  console.log("\nKept live records:");
  console.log("  ops:", remaining.icon?.name ?? "(missing Icon)");
  console.log("  private:", remaining.houseNaeem?.name ?? "(missing HOUSE NAEEM)");
  console.log("  private:", remaining.simonMeghan?.name ?? "(missing SIMON & MEGHAN)");
  console.log("\nRemaining demo markers:");
  console.log("  demo users:", remaining.demoUsersLeft);
  console.log("  kloof-house:", remaining.demoPrivateLeft);
  console.log("  demo lead notes:", remaining.demoLeadNotesLeft);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
