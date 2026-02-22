import { NextRequest } from "next/server";
import { loadArchitects } from "@/lib/architects";

function slugFromUrl(url: string): string {
  const m = url.match(/\/practice\/([^/]+)\/?$/);
  return m ? m[1] : "";
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const architects = loadArchitects();
  const decoded = decodeURIComponent(id);
  const practice = architects.find(
    (a) =>
      a.url === decoded ||
      a.url === id ||
      slugFromUrl(a.url) === decoded ||
      slugFromUrl(a.url) === id
  );
  if (!practice) {
    const idx = parseInt(id, 10);
    if (!isNaN(idx) && idx >= 0 && idx < architects.length) {
      return Response.json(architects[idx]);
    }
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  return Response.json(practice);
}
