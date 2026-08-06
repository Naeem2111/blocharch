/**
 * Delete all private projects except the latest one for client "House Naeem".
 * Cascades: updates, action items, hour logs, expenses.
 * Removes orphan PrivateClient rows when their last project is deleted.
 *
 * Usage: node scripts/delete-private-projects-except-naeem.mjs
 */
import { PrismaClient } from "@prisma/client";

const KEEP_CLIENT_NAME = "House Naeem";
const prisma = new PrismaClient();

try {
  const naeemClient = await prisma.privateClient.findFirst({
    where: { name: { equals: KEEP_CLIENT_NAME, mode: "insensitive" } },
    select: { id: true, name: true },
  });

  if (!naeemClient) {
    console.error(`No client named "${KEEP_CLIENT_NAME}" found — aborting to avoid deleting everything.`);
    process.exit(1);
  }

  const naeemProjects = await prisma.privateProject.findMany({
    where: { clientId: naeemClient.id },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    select: { id: true, name: true, createdAt: true, updatedAt: true, clientId: true },
  });

  if (naeemProjects.length === 0) {
    console.error(`Client "${naeemClient.name}" has no projects — aborting.`);
    process.exit(1);
  }

  const keep = naeemProjects[0];
  console.log("Keeping:", {
    id: keep.id,
    name: keep.name,
    client: naeemClient.name,
    createdAt: keep.createdAt.toISOString(),
    updatedAt: keep.updatedAt.toISOString(),
  });

  if (naeemProjects.length > 1) {
    console.log(
      `Note: ${naeemProjects.length} projects for "${naeemClient.name}" — keeping most recently updated.`
    );
  }

  const toDelete = await prisma.privateProject.findMany({
    where: { id: { not: keep.id } },
    select: {
      id: true,
      name: true,
      clientId: true,
      createdAt: true,
      updatedAt: true,
      client: { select: { name: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  console.log(`\nDeleting ${toDelete.length} private project(s):\n`);

  const deleted = [];
  const orphanClientIds = new Set();

  for (const project of toDelete) {
    await prisma.privateProject.delete({ where: { id: project.id } });
    deleted.push({
      id: project.id,
      name: project.name,
      client: project.client.name,
      createdAt: project.createdAt.toISOString(),
    });
    console.log(`  ✓ ${project.name} (${project.id}) — client: ${project.client.name}`);

    const remainingForClient = await prisma.privateProject.count({
      where: { clientId: project.clientId },
    });
    if (remainingForClient === 0) {
      orphanClientIds.add(project.clientId);
    }
  }

  const deletedClients = [];
  for (const clientId of orphanClientIds) {
    const client = await prisma.privateClient.delete({
      where: { id: clientId },
      select: { id: true, name: true, slug: true },
    });
    deletedClients.push(client);
    console.log(`  ✓ Orphan client removed: ${client.name} (${client.id})`);
  }

  const remaining = await prisma.privateProject.count();
  console.log("\n--- Summary ---");
  console.log(`Projects deleted: ${deleted.length}`);
  console.log(`Clients deleted (orphans): ${deletedClients.length}`);
  console.log(`Projects remaining: ${remaining}`);
  console.log(`Kept: ${keep.name} (${keep.id})`);

  if (deleted.length > 0) {
    console.log("\nDeleted project IDs:");
    for (const row of deleted) {
      console.log(`  - ${row.id} | ${row.name}`);
    }
  }
} catch (e) {
  console.error(e);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
