/**
 * Sample private-project seed is disabled so dummy clients (Whitfield, Naidoo, etc.)
 * are not recreated. House Naeem and live records are managed in the dashboard.
 *
 * Usage: node prisma/seed-private.mjs
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const count = await prisma.privateClient.count();
  console.log(
    `Private seed skipped — dummy sample projects are not loaded (${count} client${count === 1 ? "" : "s"} already in the database).`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
