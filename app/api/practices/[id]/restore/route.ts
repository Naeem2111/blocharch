import { NextRequest } from "next/server";
import { restoreArchitect } from "@/lib/architects";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const practice = await restoreArchitect(id);
    return Response.json(practice);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to restore practice";
    const status =
      message === "Practice not found"
        ? 404
        : message === "Practice is not deleted"
          ? 400
          : 400;
    return Response.json({ error: message }, { status });
  }
}
