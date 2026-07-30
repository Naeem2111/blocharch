/**
 * Seed sample private projects (idempotent — skips if any private client exists).
 * Usage: node prisma/seed-private.mjs
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.privateClient.count();
  if (existing > 0) {
    console.log("Private seed skipped — clients already exist.");
    return;
  }

  const athletes = await prisma.opsAthlete.findMany({
    where: { status: "active" },
    orderBy: { fullName: "asc" },
    take: 2,
  });
  if (athletes.length === 0) {
    console.log("Private seed skipped — no active athletes. Seed ops first.");
    return;
  }

  const [a1, a2] = [athletes[0], athletes[1] ?? athletes[0]];

  const stageStarted = new Date();
  stageStarted.setUTCDate(stageStarted.getUTCDate() - 19);

  const brief = new Date("2026-02-04T00:00:00.000Z");
  const council = new Date("2026-06-12T00:00:00.000Z");

  await prisma.$transaction(async (tx) => {
    const whitfield = await tx.privateClient.create({
      data: {
        name: "Simon & Meghan Whitfield",
        contactEmail: "simon.whitfield@email.com",
        contactPhone: "+27 82 000 0000",
        slug: "whitfield-kloof",
        portalEnabled: true,
      },
    });

    const kloof = await tx.privateProject.create({
      data: {
        clientId: whitfield.id,
        assignedAthleteId: a1.id,
        name: "47A Kloof Road, Fresnaye",
        address: "47A Kloof Road, Fresnaye",
        projectType: "residential_extension",
        designStage: "council_review",
        feeZar: 420000,
        costZar: 168000,
        stageNotes:
          "Submitted to City of Cape Town 12 Jun. Typical review window 6–8 weeks.",
        briefReceivedAt: brief,
        councilSubmittedAt: council,
        stageStartedAt: stageStarted,
      },
    });

    await tx.privateActionItem.create({
      data: {
        projectId: kloof.id,
        title: "Confirm glazing budget — needed before council queries are finalised.",
        clientFacing: true,
      },
    });

    await tx.privateProjectUpdate.createMany({
      data: [
        {
          projectId: kloof.id,
          title: "Submitted to council",
          occurredAt: council,
          clientVisible: true,
        },
        {
          projectId: kloof.id,
          title: "Confirmed in review queue",
          occurredAt: new Date("2026-06-16T00:00:00.000Z"),
          clientVisible: true,
        },
        {
          projectId: kloof.id,
          title: "Last checked in with council",
          occurredAt: new Date("2026-06-28T00:00:00.000Z"),
          clientVisible: true,
        },
      ],
    });

    const naidoo = await tx.privateClient.create({
      data: {
        name: "R. Naidoo",
        contactEmail: "r.naidoo@email.com",
        slug: "naidoo-vineyard",
        portalEnabled: true,
      },
    });

    await tx.privateProject.create({
      data: {
        clientId: naidoo.id,
        assignedAthleteId: a2.id,
        name: "12 Vineyard Close, Constantia",
        address: "12 Vineyard Close, Constantia",
        projectType: "residential_extension",
        designStage: "council_submission_docs",
        feeZar: 310000,
        costZar: 142600,
        briefReceivedAt: new Date("2026-03-01T00:00:00.000Z"),
        stageStartedAt: new Date(),
      },
    });

    const marsh = await tx.privateClient.create({
      data: {
        name: "L. Marsh",
        slug: "marsh-cliff",
        portalEnabled: true,
      },
    });

    await tx.privateProject.create({
      data: {
        clientId: marsh.id,
        assignedAthleteId: a1.id,
        name: "8 Cliff Road, Camps Bay",
        address: "8 Cliff Road, Camps Bay",
        projectType: "residential_extension",
        designStage: "concept_design",
        feeZar: 275000,
        costZar: 115500,
        briefReceivedAt: new Date("2026-05-20T00:00:00.000Z"),
        stageStartedAt: new Date(),
      },
    });

    const coetzee = await tx.privateClient.create({
      data: {
        name: "T. Coetzee",
        slug: "coetzee-vredehoek",
        portalEnabled: true,
      },
    });

    await tx.privateProject.create({
      data: {
        clientId: coetzee.id,
        assignedAthleteId: a2.id,
        name: "3 Vredehoek Ave",
        address: "3 Vredehoek Ave, Vredehoek",
        projectType: "residential_extension",
        designStage: "existing_drawings",
        feeZar: 198000,
        costZar: 95040,
        briefReceivedAt: new Date("2026-06-10T00:00:00.000Z"),
        stageStartedAt: new Date(),
      },
    });

    // Sample hours this week for capacity bar
    const today = new Date();
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    await tx.privateHourLog.create({
      data: {
        projectId: kloof.id,
        athleteId: a1.id,
        workDate: d,
        hours: 3.5,
        notes: "Reviewed council query on boundary line, drafted response.",
      },
    });
  });

  console.log("Private seed complete. Client portal: /private/whitfield-kloof");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
