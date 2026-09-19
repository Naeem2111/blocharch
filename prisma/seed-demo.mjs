/**
 * End-to-end demo tour seed (idempotent, additive).
 *
 * Fills empty product surfaces without wiping the directory or mutating
 * live clients such as Icon Architects / Simon & Meghan.
 *
 *   npm run db:seed:demo
 *
 * Logins
 *   blocharch / blocharch   admin
 *   manager01 / manager01   manager
 *   sales01   / sales01     sales
 *   athlete01 / athlete01   athlete (Maya Reed)
 *   athlete02 / athlete02   athlete (Liam Nkosi)
 *
 * Portals
 *   /clients/harbour-studio
 *   /clients/wright-cole
 *   /private/kloof-house
 */
import { PrismaClient } from "@prisma/client";
import crypto from "node:crypto";
import { randomBytes, scryptSync } from "node:crypto";

const prisma = new PrismaClient();

const MARKER_KEY = "demo_tour_seed";
const HARBOUR_SLUG = "harbour-studio";
const WRIGHT_SLUG = "wright-cole";
const KLOOF_SLUG = "kloof-house";

const PLANNER_COLUMNS = [
  { title: "General", color: "#64748b", sortOrder: 0, linkedLabelName: null },
  { title: "This Week", color: "#3b82f6", sortOrder: 1, linkedLabelName: "This Week" },
  { title: "Tomorrow", color: "#0ea5e9", sortOrder: 2, linkedLabelName: "Tomorrow" },
  { title: "Urgent", color: "#f97316", sortOrder: 3, linkedLabelName: "Urgent" },
  { title: "Urgent Today", color: "#ef4444", sortOrder: 4, linkedLabelName: "Urgent Today" },
  { title: "Waiting", color: "#64748b", sortOrder: 5, linkedLabelName: "Waiting" },
  { title: "Done", color: "#22c55e", sortOrder: 6, linkedLabelName: null },
];

const PLANNER_LABELS = PLANNER_COLUMNS.filter((c) => c.linkedLabelName).map((c) => ({
  name: c.linkedLabelName,
  color: c.color,
}));

function hashPasswordScrypt(plain) {
  const salt = randomBytes(16);
  const hash = scryptSync(plain, salt, 32, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString("base64")}$${hash.toString("base64")}`;
}

function utcDate(y, m, d) {
  return new Date(Date.UTC(y, m - 1, d));
}

function addDays(date, days) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function dateOnly(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function recentWeekdays(count, from = new Date()) {
  const dates = [];
  const cursor = dateOnly(from);
  while (dates.length < count) {
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) dates.push(new Date(cursor));
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return dates.reverse();
}

async function ensureUser(username, password, role) {
  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    if (existing.disabled || existing.role !== role) {
      return prisma.user.update({
        where: { id: existing.id },
        data: { disabled: false, role },
      });
    }
    return existing;
  }
  return prisma.user.create({
    data: {
      id: crypto.randomUUID(),
      username,
      passwordHash: hashPasswordScrypt(password),
      role,
      disabled: false,
    },
  });
}

async function ensureAthlete(user, { fullName, athleteCode, email }) {
  const existing = await prisma.opsAthlete.findUnique({ where: { userId: user.id } });
  if (existing) return existing;
  const byCode = await prisma.opsAthlete.findUnique({ where: { athleteCode } });
  if (byCode) return byCode;
  return prisma.opsAthlete.create({
    data: {
      userId: user.id,
      fullName,
      athleteCode,
      email,
      blocharchStartDate: utcDate(2025, 3, 1),
      baseMonthlyPayZar: 22000,
      monthlyHourCap: 160,
      overtimeRateZar: 200,
      privateWeeklyCapHours: 8,
      status: "active",
      profilePhotoBgColor: athleteCode === "ATH-D1" ? "#0ea5e9" : "#8b5cf6",
      profilePhotoTextTone: "light",
    },
  });
}

async function ensureBoard({ title, scope, kind, ownerId, athleteId, opsProjectId, isSystem, color }) {
  const existing = await prisma.plannerBoard.findFirst({
    where: {
      kind,
      ownerId,
      athleteId: athleteId ?? null,
      opsProjectId: opsProjectId ?? null,
      ...(kind === "custom" || kind === "project" ? { title } : {}),
    },
  });
  if (existing) {
    await ensureBoardScaffold(existing.id);
    return existing;
  }
  const board = await prisma.plannerBoard.create({
    data: {
      title,
      scope,
      kind,
      color: color ?? "#6366f1",
      ownerId,
      athleteId: athleteId ?? null,
      opsProjectId: opsProjectId ?? null,
      isSystem: Boolean(isSystem),
    },
  });
  await ensureBoardScaffold(board.id);
  return board;
}

async function ensureBoardScaffold(boardId) {
  const columns = await prisma.plannerColumn.findMany({ where: { boardId } });
  if (columns.length === 0) {
    await prisma.plannerColumn.createMany({
      data: PLANNER_COLUMNS.map((c) => ({ boardId, ...c })),
    });
  }
  const labels = await prisma.plannerLabel.findMany({ where: { boardId } });
  const have = new Set(labels.map((l) => l.name));
  for (const label of PLANNER_LABELS) {
    if (!have.has(label.name)) {
      await prisma.plannerLabel.create({ data: { boardId, ...label } });
    }
  }
}

async function columnByTitle(boardId, title) {
  return prisma.plannerColumn.findFirst({
    where: { boardId, title },
    select: { id: true },
  });
}

async function ensureTask(boardId, columnTitle, data) {
  const column = await columnByTitle(boardId, columnTitle);
  if (!column) return null;
  const existing = await prisma.plannerTask.findFirst({
    where: { column: { boardId }, title: data.title },
  });
  if (existing) return existing;
  const max = await prisma.plannerTask.aggregate({
    where: { columnId: column.id },
    _max: { sortOrder: true },
  });
  return prisma.plannerTask.create({
    data: {
      columnId: column.id,
      title: data.title,
      summary: data.summary ?? null,
      dueAt: data.dueAt ?? null,
      assigneeId: data.assigneeId ?? null,
      sortOrder: (max._max.sortOrder ?? -1) + 1,
    },
  });
}

async function ensureAssignment(projectId, athleteId, isPrimary) {
  await prisma.opsProjectAthleteAssignment.upsert({
    where: { projectId_athleteId: { projectId, athleteId } },
    update: { isPrimary, removedAt: null },
    create: { projectId, athleteId, isPrimary },
  });
}

async function seedUsersAndAthletes() {
  const admin = await ensureUser("blocharch", "blocharch", "admin");
  const manager = await ensureUser("manager01", "manager01", "manager");
  const sales = await ensureUser("sales01", "sales01", "sales");
  const athleteUser1 = await ensureUser("athlete01", "athlete01", "user");
  const athleteUser2 = await ensureUser("athlete02", "athlete02", "user");

  const maya = await ensureAthlete(athleteUser1, {
    fullName: "Maya Reed",
    athleteCode: "ATH-D1",
    email: "maya.reed@example.com",
  });
  const liam = await ensureAthlete(athleteUser2, {
    fullName: "Liam Nkosi",
    athleteCode: "ATH-D2",
    email: "liam.nkosi@example.com",
  });

  return { admin, manager, sales, maya, liam };
}

async function seedOpsClients(athletes) {
  const harbour =
    (await prisma.opsClient.findUnique({ where: { slug: HARBOUR_SLUG } })) ??
    (await prisma.opsClient.create({
      data: {
        name: "Harbour Studio",
        companyName: "Harbour Studio Ltd",
        software: "Revit, AutoCAD",
        country: "UK",
        phone: "+44 20 7946 0018",
        slug: HARBOUR_SLUG,
        publicPortalEnabled: true,
        logoBgColor: "#0f766e",
        logoTextTone: "light",
        notes: "Demo UK production-lane client for portal walkthroughs.",
        contacts: {
          create: [
            { name: "Elena Harbour", email: "elena@harbourstudio.example", sortOrder: 0 },
            { name: "Tom Graves", email: "tom@harbourstudio.example", sortOrder: 1 },
          ],
        },
        commercial: {
          create: {
            pricingTier: "tier_30",
            tierPercent: 30,
            laneCostGbp: 2041,
            overtimeBillingGbp: 20,
            activeLaneCount: 1,
            notes: "One lane so monthly hours can show overtime in the portal.",
          },
        },
      },
    }));

  if (!harbour.publicPortalEnabled || harbour.slug !== HARBOUR_SLUG) {
    await prisma.opsClient.update({
      where: { id: harbour.id },
      data: { publicPortalEnabled: true, slug: HARBOUR_SLUG },
    });
  }
  if (!(await prisma.opsClientCommercialProfile.findUnique({ where: { clientId: harbour.id } }))) {
    await prisma.opsClientCommercialProfile.create({
      data: {
        clientId: harbour.id,
        pricingTier: "tier_30",
        tierPercent: 30,
        laneCostGbp: 2041,
        overtimeBillingGbp: 20,
        activeLaneCount: 1,
      },
    });
  }
  await prisma.opsClientCommercialProfile.update({
    where: { clientId: harbour.id },
    data: { activeLaneCount: 1 },
  });

  const wright =
    (await prisma.opsClient.findUnique({ where: { slug: WRIGHT_SLUG } })) ??
    (await prisma.opsClient.create({
      data: {
        name: "Wright & Cole",
        companyName: "Wright & Cole Architects",
        software: "Archicad",
        country: "UK",
        slug: WRIGHT_SLUG,
        publicPortalEnabled: true,
        logoBgColor: "#1d4ed8",
        logoTextTone: "light",
        notes: "Second demo client so ops filters are not a single-client view.",
        contacts: {
          create: [{ name: "Priya Cole", email: "priya@wrightcole.example", sortOrder: 0 }],
        },
        commercial: {
          create: {
            pricingTier: "tier_25",
            tierPercent: 25,
            laneCostGbp: 2187,
            overtimeBillingGbp: 20,
            activeLaneCount: 1,
          },
        },
      },
    }));

  const harbourContacts = await prisma.opsClientContact.findMany({
    where: { clientId: harbour.id },
    orderBy: { sortOrder: "asc" },
  });
  const wrightContacts = await prisma.opsClientContact.findMany({
    where: { clientId: wright.id },
    orderBy: { sortOrder: "asc" },
  });

  const projects = await seedOpsProjects({
    harbour,
    wright,
    harbourLead: harbourContacts[0] ?? null,
    wrightLead: wrightContacts[0] ?? null,
    maya: athletes.maya,
    liam: athletes.liam,
  });

  await seedPipeline(harbour.id);
  await seedSubmissions({ harbour, wright, projects, maya: athletes.maya, liam: athletes.liam });
  await seedCheckInsAndNotifications({ projects, maya: athletes.maya, liam: athletes.liam });

  return { harbour, wright, projects };
}

async function seedOpsProjects({ harbour, wright, harbourLead, wrightLead, maya, liam }) {
  const specs = [
    {
      clientId: harbour.id,
      athlete: maya,
      lead: harbourLead,
      name: "14 Narrow Street warehouse",
      projectNumber: "DEMO-1401",
      address: "14 Narrow Street, London E14 8BP",
      stage: "proposed_drawings",
      status: "in_progress",
      complexity: "high",
      start: utcDate(2026, 8, 4),
      due: utcDate(2026, 9, 25),
      progress: 62,
      quoted: 80,
      description: "Existing warehouse conversion to live/work. Proposed drawings in review.",
      deliverables: [
        { label: "Existing GA pack", url: "https://www.blocharch.com/" },
        { label: "Proposed elevations (WIP)", url: null },
      ],
    },
    {
      clientId: harbour.id,
      athlete: liam,
      lead: harbourLead,
      name: "9 Cable Street loft",
      projectNumber: "DEMO-1402",
      address: "9 Cable Street, London E1 8EZ",
      stage: "tender_construction_pack",
      status: "waiting_on_feedback",
      complexity: "medium",
      start: utcDate(2026, 7, 14),
      due: utcDate(2026, 9, 30),
      progress: 88,
      quoted: 64,
      description: "Tender pack paused pending client joinery decisions.",
      deliverables: [{ label: "Tender issue v2", url: "https://www.blocharch.com/" }],
    },
    {
      clientId: harbour.id,
      athlete: maya,
      lead: harbourLead,
      name: "22 Wapping High Street",
      projectNumber: "DEMO-1390",
      address: "22 Wapping High Street, London E1W 1NG",
      stage: "survey_conversion",
      status: "completed",
      complexity: "low",
      start: utcDate(2026, 6, 2),
      due: utcDate(2026, 7, 18),
      completed: utcDate(2026, 7, 15),
      progress: 100,
      quoted: 40,
      beatenDays: 3,
      beatenMinutes: 3 * 24 * 60,
      description: "Survey conversion completed three days early.",
      deliverables: [{ label: "Issued survey pack", url: "https://www.blocharch.com/" }],
    },
    {
      clientId: wright.id,
      athlete: liam,
      lead: wrightLead,
      name: "The Coach House, Richmond",
      projectNumber: "DEMO-2201",
      address: "The Coach House, Richmond TW9 1AA",
      stage: "survey_conversion",
      status: "in_progress",
      complexity: "medium",
      start: utcDate(2026, 9, 1),
      due: utcDate(2026, 10, 10),
      progress: 28,
      quoted: 48,
      description: "New Wright & Cole pack — survey conversion underway.",
      deliverables: [{ label: "Point-cloud register", url: null }],
    },
  ];

  const created = {};
  for (const spec of specs) {
    let project = await prisma.opsProject.findFirst({
      where: { clientId: spec.clientId, projectNumber: spec.projectNumber },
    });
    const data = {
      clientId: spec.clientId,
      assignedAthleteId: spec.athlete.id,
      projectLeadContactId: spec.lead?.id ?? null,
      projectLead: spec.lead?.name ?? "Elena Harbour",
      name: spec.name,
      projectNumber: spec.projectNumber,
      address: spec.address,
      complexity: spec.complexity,
      currentStage: spec.stage,
      currentStatus: spec.status,
      startDate: spec.start,
      dueDate: spec.due,
      progressPercent: spec.progress,
      quotedHours: spec.quoted,
      completedAt: spec.completed ?? null,
      deadlineBeatenDays: spec.beatenDays ?? null,
      deadlineBeatenMinutes: spec.beatenMinutes ?? null,
      clientDescription: spec.description,
      clientDeliverables: spec.deliverables,
    };
    if (!project) {
      project = await prisma.opsProject.create({ data });
    } else if (!project.clientDescription) {
      project = await prisma.opsProject.update({
        where: { id: project.id },
        data: {
          clientDescription: spec.description,
          clientDeliverables: spec.deliverables,
          quotedHours: spec.quoted,
          progressPercent: spec.progress,
        },
      });
    }
    await ensureAssignment(project.id, spec.athlete.id, true);
    created[spec.projectNumber] = project;
  }
  return created;
}

async function seedPipeline(harbourId) {
  const rows = [
    {
      name: "36 Rotherhithe Street",
      address: "36 Rotherhithe Street, London SE16 5PP",
      description: "Survey conversion after September coordination meeting.",
      expectedStage: "survey_conversion",
      targetStartDate: utcDate(2026, 10, 6),
      targetDueDate: utcDate(2026, 10, 24),
      sortOrder: 0,
    },
    {
      name: "1 Shad Thames penthouse",
      address: "1 Shad Thames, London SE1 2AT",
      description: "Proposed drawings once planning sketches are signed off.",
      expectedStage: "proposed_drawings",
      targetStartDate: utcDate(2026, 10, 13),
      targetDueDate: utcDate(2026, 11, 14),
      sortOrder: 1,
    },
    {
      name: "Limehouse Basin studio",
      address: "Limehouse Basin, London E14 8BT",
      description: "Dates to be confirmed — holding slot for November.",
      expectedStage: "survey_conversion",
      targetStartDate: null,
      targetDueDate: null,
      sortOrder: 2,
    },
  ];
  for (const row of rows) {
    const existing = await prisma.opsPipelineProject.findFirst({
      where: { clientId: harbourId, name: row.name, convertedAt: null },
    });
    if (!existing) {
      await prisma.opsPipelineProject.create({
        data: { clientId: harbourId, visibleToClient: true, ...row },
      });
    }
  }
}

async function seedSubmissions({ harbour, wright, projects, maya, liam }) {
  const days = recentWeekdays(12, utcDate(2026, 9, 18));
  const harbourActive = projects["DEMO-1401"];
  const harbourTender = projects["DEMO-1402"];
  const wrightActive = projects["DEMO-2201"];
  if (!harbourActive || !harbourTender || !wrightActive) return;

  for (let i = 0; i < days.length; i++) {
    const day = days[i];
    const mayaHours = 14;
    const liamHours = 6.5;

    const mayaSub = await prisma.opsDailySubmission.upsert({
      where: { athleteId_submissionDate: { athleteId: maya.id, submissionDate: day } },
      update: { totalHours: mayaHours, dailyNote: "Demo tour hours — Narrow Street.", lockedAt: addDays(day, 1) },
      create: {
        athleteId: maya.id,
        submissionDate: day,
        totalHours: mayaHours,
        dailyNote: "Demo tour hours — Narrow Street warehouse.",
        lockedAt: addDays(day, 1),
      },
    });
    const existingMaya = await prisma.opsSubmissionLineItem.count({ where: { submissionId: mayaSub.id } });
    if (existingMaya === 0) {
      await prisma.opsSubmissionLineItem.create({
        data: {
          submissionId: mayaSub.id,
          clientId: harbour.id,
          projectId: harbourActive.id,
          projectPhase: "proposed_drawings",
          taskType: "elevations",
          taskTypes: ["elevations", "plans"],
          hoursWorked: mayaHours,
          completionPercent: Math.min(62, 20 + i * 4),
          urgencyStatus: i === days.length - 1 ? "critical" : "normal",
          completedSummary: "Proposed elevations and window schedule.",
        },
      });
    } else {
      await prisma.opsSubmissionLineItem.updateMany({
        where: { submissionId: mayaSub.id, projectId: harbourActive.id },
        data: { hoursWorked: mayaHours },
      });
    }

    const liamSub = await prisma.opsDailySubmission.upsert({
      where: { athleteId_submissionDate: { athleteId: liam.id, submissionDate: day } },
      update: { totalHours: liamHours, lockedAt: addDays(day, 1) },
      create: {
        athleteId: liam.id,
        submissionDate: day,
        totalHours: liamHours,
        dailyNote: i % 2 === 0 ? "Tender pack joinery markups." : "Coach House survey conversion.",
        lockedAt: addDays(day, 1),
      },
    });
    const existingLiam = await prisma.opsSubmissionLineItem.count({ where: { submissionId: liamSub.id } });
    if (existingLiam === 0) {
      const useWright = i % 3 === 0;
      await prisma.opsSubmissionLineItem.create({
        data: {
          submissionId: liamSub.id,
          clientId: useWright ? wright.id : harbour.id,
          projectId: useWright ? wrightActive.id : harbourTender.id,
          projectPhase: useWright ? "survey_conversion" : "tender_construction_pack",
          taskType: useWright ? "plans" : "joinery_drawings",
          taskTypes: useWright ? ["plans"] : ["joinery_drawings"],
          hoursWorked: liamHours,
          completionPercent: useWright ? 28 : 88,
          urgencyStatus: "normal",
          completedSummary: useWright ? "Survey traces." : "Joinery details for tender.",
        },
      });
    }
  }
}

async function seedCheckInsAndNotifications({ projects, maya, liam }) {
  const harbourActive = projects["DEMO-1401"];
  if (!harbourActive) return;

  const pendingStart = utcDate(2026, 9, 22);
  pendingStart.setUTCHours(10, 0, 0, 0);
  const existingPending = await prisma.opsCheckInRequest.findFirst({
    where: { athleteId: maya.id, reason: "Joinery set-out clash on Narrow Street" },
  });
  if (!existingPending) {
    await prisma.opsCheckInRequest.create({
      data: {
        source: "book_a_call",
        athleteId: maya.id,
        projectId: harbourActive.id,
        reason: "Joinery set-out clash on Narrow Street",
        contextNotes: "Need 20 minutes with Elena before issuing proposed elevations.",
        requestedStartAt: pendingStart,
        requestedEndAt: new Date(pendingStart.getTime() + 30 * 60 * 1000),
        status: "pending",
      },
    });
  }

  const confirmedStart = utcDate(2026, 9, 17);
  confirmedStart.setUTCHours(15, 0, 0, 0);
  const existingConfirmed = await prisma.opsCheckInRequest.findFirst({
    where: { athleteId: liam.id, reason: "Weekly production check-in" },
  });
  if (!existingConfirmed) {
    await prisma.opsCheckInRequest.create({
      data: {
        source: "daily_log",
        athleteId: liam.id,
        projectId: projects["DEMO-1402"]?.id ?? null,
        reason: "Weekly production check-in",
        contextNotes: "Tender pack waiting on client joinery sign-off.",
        requestedStartAt: confirmedStart,
        requestedEndAt: new Date(confirmedStart.getTime() + 30 * 60 * 1000),
        status: "confirmed",
        zoomLink: "https://zoom.us/j/0000000000",
        resolvedAt: utcDate(2026, 9, 16),
      },
    });
  }

  const notifs = [
    {
      athleteId: maya.id,
      projectId: harbourActive.id,
      type: "check_in_request",
      title: "Check-in requested — Narrow Street",
      message: "Maya asked for a 30-minute call on the joinery clash.",
      actionRequired: "Schedule or decline in Check-in requests.",
    },
    {
      athleteId: liam.id,
      projectId: projects["DEMO-1402"]?.id ?? null,
      type: "review_request",
      title: "Tender pack waiting on feedback",
      message: "9 Cable Street loft is paused at 88% pending joinery decisions.",
    },
  ];
  for (const n of notifs) {
    const exists = await prisma.opsNotification.findFirst({ where: { title: n.title } });
    if (!exists) await prisma.opsNotification.create({ data: n });
  }

  const athleteNotifs = [
    {
      athleteId: maya.id,
      type: "admin_message",
      title: "Welcome to the demo workspace",
      message: "Log hours on Narrow Street and open the Harbour Studio portal to see progress.",
      linkPath: "/dashboard/athlete/projects",
    },
    {
      athleteId: liam.id,
      type: "task_assigned",
      title: "Coach House survey assigned",
      message: "Wright & Cole — The Coach House is on your board for this week.",
      linkPath: "/dashboard/athlete/projects",
    },
  ];
  for (const n of athleteNotifs) {
    const exists = await prisma.opsAthleteNotification.findFirst({
      where: { athleteId: n.athleteId, title: n.title },
    });
    if (!exists) await prisma.opsAthleteNotification.create({ data: n });
  }
}

async function seedPlanner({ admin, maya, liam, projects }) {
  await ensureBoard({
    title: "Blocharch Outbox",
    scope: "team",
    kind: "blocharch_outbox",
    ownerId: admin.id,
    isSystem: true,
    color: "#f59e0b",
  });

  const mayaPersonal = await ensureBoard({
    title: "Personal",
    scope: "personal",
    kind: "custom",
    ownerId: maya.userId,
    athleteId: maya.id,
    color: "#64748b",
  });
  const liamPersonal = await ensureBoard({
    title: "Personal",
    scope: "personal",
    kind: "custom",
    ownerId: liam.userId,
    athleteId: liam.id,
    color: "#64748b",
  });

  const harbourActive = projects["DEMO-1401"];
  if (harbourActive) {
    const projectBoard = await ensureBoard({
      title: "14 Narrow Street warehouse",
      scope: "team",
      kind: "project",
      ownerId: admin.id,
      athleteId: maya.id,
      opsProjectId: harbourActive.id,
      color: "#06b6d4",
    });
    await ensureTask(projectBoard.id, "This Week", {
      title: "Issue proposed south elevation",
      summary: "Client-facing sheet for Harbour Studio portal.",
      dueAt: utcDate(2026, 9, 23),
      assigneeId: maya.userId,
    });
    await ensureTask(projectBoard.id, "Waiting", {
      title: "Confirm glazing spec with Elena",
      summary: "Blocked until Friday call.",
      dueAt: utcDate(2026, 9, 22),
      assigneeId: maya.userId,
    });
    await ensureTask(projectBoard.id, "Done", {
      title: "Existing GA pack issued",
      summary: "Uploaded as a portal deliverable.",
      assigneeId: maya.userId,
    });
  }

  await ensureTask(mayaPersonal.id, "Urgent Today", {
    title: "Upload Narrow Street WIP elevations",
    summary: "Before the 10:00 check-in.",
    dueAt: utcDate(2026, 9, 19),
    assigneeId: maya.userId,
  });
  await ensureTask(liamPersonal.id, "This Week", {
    title: "Trace Coach House existing walls",
    summary: "Wright & Cole survey conversion.",
    dueAt: utcDate(2026, 9, 24),
    assigneeId: liam.userId,
  });
}

async function seedPrivate({ maya }) {
  let client = await prisma.privateClient.findUnique({ where: { slug: KLOOF_SLUG } });
  if (!client) {
    client = await prisma.privateClient.create({
      data: {
        name: "Simon & Meghan Whitfield",
        contactEmail: "simon.whitfield@example.com",
        contactPhone: "+27 82 000 0100",
        slug: KLOOF_SLUG,
        portalEnabled: true,
        notes: "Demo Cape Town private-project portal.",
      },
    });
  } else if (!client.portalEnabled) {
    client = await prisma.privateClient.update({
      where: { id: client.id },
      data: { portalEnabled: true },
    });
  }

  let project = await prisma.privateProject.findFirst({
    where: { clientId: client.id, name: "47A Kloof Road, Fresnaye" },
  });
  if (!project) {
    project = await prisma.privateProject.create({
      data: {
        clientId: client.id,
        assignedAthleteId: maya.id,
        name: "47A Kloof Road, Fresnaye",
        address: "47A Kloof Road, Fresnaye, Cape Town",
        projectType: "residential_extension",
        designStage: "design_review",
        status: "active",
        feeZar: 420000,
        costZar: 168000,
        clientDescription: "First-floor extension and kitchen remodel. Design review with the family this week.",
        briefReceivedAt: utcDate(2026, 7, 8),
        stageStartedAt: utcDate(2026, 9, 13),
        dueDate: utcDate(2026, 11, 20),
        stageNotes: "Client reviewing glazing options before design development.",
        manualProgressPercent: 48,
      },
    });
  } else if (!project.clientDescription) {
    project = await prisma.privateProject.update({
      where: { id: project.id },
      data: {
        clientDescription:
          "First-floor extension and kitchen remodel. Design review with the family this week.",
      },
    });
  }

  await prisma.privateProjectAthleteAssignment.upsert({
    where: { projectId_athleteId: { projectId: project.id, athleteId: maya.id } },
    update: { isPrimary: true, removedAt: null },
    create: { projectId: project.id, athleteId: maya.id, isPrimary: true },
  });

  const updates = [
    { title: "Site measure-up complete", body: "Full existing fabric recorded.", occurredAt: utcDate(2026, 7, 12) },
    { title: "Concept issued", body: "Two massing options shared with the family.", occurredAt: utcDate(2026, 8, 4) },
    {
      title: "Design review in progress",
      body: "Refining the street elevation after last week's comments.",
      occurredAt: utcDate(2026, 9, 13),
    },
  ];
  for (const u of updates) {
    const exists = await prisma.privateProjectUpdate.findFirst({
      where: { projectId: project.id, title: u.title },
    });
    if (!exists) {
      await prisma.privateProjectUpdate.create({
        data: { projectId: project.id, clientVisible: true, ...u },
      });
    } else if (!exists.clientVisible) {
      await prisma.privateProjectUpdate.update({
        where: { id: exists.id },
        data: { clientVisible: true },
      });
    }
  }

  const openAction = await prisma.privateActionItem.findFirst({
    where: { projectId: project.id, title: { contains: "glazing" } },
  });
  if (!openAction) {
    await prisma.privateActionItem.create({
      data: {
        projectId: project.id,
        title: "Confirm glazing budget before we freeze the street elevation.",
        clientFacing: true,
      },
    });
  } else if (openAction.completedAt) {
    await prisma.privateActionItem.update({
      where: { id: openAction.id },
      data: { completedAt: null, clientFacing: true },
    });
  }

  const doneAction = await prisma.privateActionItem.findFirst({
    where: { projectId: project.id, title: "Share title deed" },
  });
  if (!doneAction) {
    await prisma.privateActionItem.create({
      data: {
        projectId: project.id,
        title: "Share title deed",
        clientFacing: true,
        completedAt: utcDate(2026, 9, 11),
      },
    });
  }

  const doc = await prisma.privateProjectDocument.findFirst({
    where: { projectId: project.id, title: "Concept pack" },
  });
  if (!doc) {
    await prisma.privateProjectDocument.create({
      data: {
        projectId: project.id,
        title: "Concept pack",
        originalName: "kloof-concept-pack.pdf",
        fileUrl: "https://www.blocharch.com/",
        mimeType: "application/pdf",
        clientVisible: true,
      },
    });
  }

  const hourDays = [utcDate(2026, 9, 8), utcDate(2026, 9, 10), utcDate(2026, 9, 15)];
  for (const workDate of hourDays) {
    const exists = await prisma.privateHourLog.findFirst({
      where: { projectId: project.id, athleteId: maya.id, workDate },
    });
    if (!exists) {
      await prisma.privateHourLog.create({
        data: {
          projectId: project.id,
          athleteId: maya.id,
          workDate,
          hours: 3.5,
          notes: "Design review drawings.",
        },
      });
    }
  }

  const expense = await prisma.privateProjectExpense.findFirst({
    where: { projectId: project.id, description: "Land surveyor" },
  });
  if (!expense) {
    await prisma.privateProjectExpense.create({
      data: {
        projectId: project.id,
        description: "Land surveyor",
        amountZar: 12500,
        expenseDate: utcDate(2026, 7, 20),
        kind: "third_party",
        designStage: "site_measure_up",
      },
    });
  }
}

async function seedLeadNurture() {
  const alreadyDemo = await prisma.lead.count({
    where: { notes: "Demo tour sample outreach." },
  });
  if (alreadyDemo >= 8) return { updated: alreadyDemo };

  const cold = await prisma.lead.findMany({
    where: {
      stage: "cold",
      touchCount: 0,
      architect: { deletedAt: null, email: { not: null } },
    },
    orderBy: { architectUrl: "asc" },
    take: 18,
    include: { architect: { select: { name: true, email: true, contact: true, url: true } } },
  });
  if (cold.length < 8) return { updated: 0 };

  const today = utcDate(2026, 9, 19);
  const scenarios = [
    { stage: "first_email_sent", type: "first_email", daysAgo: 12, followUpIn: 5, rating: 3 },
    { stage: "follow_up_sent", type: "follow_up_email", daysAgo: 4, followUpIn: 3, rating: 4 },
    { stage: "follow_up_due", type: "first_email", daysAgo: 8, followUpIn: 0, rating: 3 },
    { stage: "follow_up_due", type: "follow_up_email", daysAgo: 10, followUpIn: -2, rating: 2 },
    { stage: "positive_reply", type: "inbound_reply", daysAgo: 2, followUpIn: 7, rating: 5, inbound: true },
    { stage: "interested", type: "call", daysAgo: 1, followUpIn: 4, rating: 5 },
    { stage: "targeted", type: "note", daysAgo: 0, followUpIn: 14, rating: 4 },
    { stage: "negative_reply", type: "inbound_reply", daysAgo: 6, followUpIn: null, rating: 1, inbound: true },
  ];

  let updated = 0;
  for (let i = 0; i < scenarios.length; i++) {
    const lead = cold[i];
    const s = scenarios[i];
    const contactDate = addDays(today, -s.daysAgo);
    const followUpDueAt = s.followUpIn == null ? null : addDays(today, s.followUpIn);
    const already = await prisma.leadOutreachLog.count({ where: { leadId: lead.id } });
    if (already > 0) continue;

    await prisma.leadOutreachLog.create({
      data: {
        leadId: lead.id,
        stageAtLog: s.stage === "follow_up_due" ? "first_email_sent" : s.stage,
        communicationType: s.type,
        direction: s.inbound ? "inbound" : "outbound",
        contactPerson: lead.architect.contact,
        emailAddress: lead.architect.email,
        subject: s.inbound ? "Re: Blocharch introduction" : "Introduction — Blocharch production support",
        messageBody: s.inbound
          ? "Thanks — happy to look at this in more detail next week."
          : "Demo outreach log for the lead-nurturing walkthrough.",
        contactDate,
        followUpDueAt,
        nextAction: s.followUpIn == null ? null : "Follow up from Lead nurturing",
      },
    });
    await prisma.lead.update({
      where: { id: lead.id },
      data: {
        stage: s.stage,
        rating: s.rating,
        lastContactedAt: contactDate,
        lastEmailedAt: s.inbound ? lead.lastEmailedAt : contactDate,
        lastCommunicationType: s.type,
        touchCount: s.inbound ? 1 : 1,
        followUpDueAt,
        nextAction: s.followUpIn == null ? null : "Follow up",
        notes: "Demo tour sample outreach.",
      },
    });
    updated += 1;
  }
  return { updated };
}

async function seedCatalogAndFx() {
  const customPhase = await prisma.opsCatalogPhase.findFirst({
    where: { label: "BIM coordination pack" },
  });
  if (!customPhase) {
    await prisma.opsCatalogPhase.create({
      data: { label: "BIM coordination pack", sortOrder: 80 },
    });
  }
  const customType = await prisma.opsCatalogWorkType.findFirst({
    where: { label: "Clash detection" },
  });
  if (!customType) {
    await prisma.opsCatalogWorkType.create({
      data: { label: "Clash detection", sortOrder: 80 },
    });
  }

  const month = utcDate(2026, 9, 1);
  const fx = await prisma.opsExchangeRate.findFirst({
    where: { effectiveMonth: month, rateType: "reporting", activeFlag: true },
  });
  if (!fx) {
    await prisma.opsExchangeRate.create({
      data: {
        effectiveMonth: month,
        gbpToZarRate: 23.45,
        rateType: "reporting",
        activeFlag: true,
      },
    });
  }
}

async function main() {
  const people = await seedUsersAndAthletes();
  const ops = await seedOpsClients(people);
  await seedPlanner({ admin: people.admin, maya: people.maya, liam: people.liam, projects: ops.projects });
  await seedPrivate({ maya: people.maya });
  const leads = await seedLeadNurture();
  await seedCatalogAndFx();

  await prisma.opsAppSetting.upsert({
    where: { key: MARKER_KEY },
    update: { value: new Date().toISOString() },
    create: { key: MARKER_KEY, value: new Date().toISOString() },
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        logins: {
          admin: "blocharch / blocharch",
          manager: "manager01 / manager01",
          sales: "sales01 / sales01",
          athlete: "athlete01 / athlete01",
          athlete2: "athlete02 / athlete02",
        },
        portals: {
          ops: [`/clients/${HARBOUR_SLUG}`, `/clients/${WRIGHT_SLUG}`],
          private: [`/private/${KLOOF_SLUG}`],
        },
        leadsUpdated: leads.updated,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((err) => {
    console.error("Demo seed failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
