import { listMarketingNotifications } from "@/lib/lead-outreach";

export const dynamic = "force-dynamic";

export async function GET() {
  const items = await listMarketingNotifications();
  return Response.json({ items, total: items.length });
}
