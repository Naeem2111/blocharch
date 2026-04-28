import { NextRequest } from "next/server";
import { searchArchitects } from "@/lib/architects";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") || undefined;
  const page = parseInt(searchParams.get("page") || "1", 10);
  const perPage = parseInt(searchParams.get("perPage") || "25", 10);

  const result = await searchArchitects({ q, page, perPage });
  return Response.json(result);
}
