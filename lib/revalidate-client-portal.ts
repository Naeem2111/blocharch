import { revalidatePath } from "next/cache";
import { clientPortalPath } from "@/lib/client-slug";
import { prisma } from "@/lib/prisma";

export async function revalidateClientPortalByClientId(clientId: string) {
  const client = await prisma.opsClient.findUnique({
    where: { id: clientId },
    select: { slug: true, publicPortalEnabled: true },
  });
  if (client?.slug && client.publicPortalEnabled) {
    revalidatePath(clientPortalPath(client.slug));
  }
}
