import { loadArchitects } from "@/lib/architects";

export async function GET() {
  const architects = loadArchitects();
  const total = architects.length;
  const withEmail = architects.filter((a) => a.email && a.email.trim()).length;
  return Response.json({ total, withEmail });
}
