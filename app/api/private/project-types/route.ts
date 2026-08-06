import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requirePrivateOpsSession } from "@/lib/private-access";
import { listPrivateProjectTypeOptions } from "@/lib/private-project-types";

export async function GET(request: NextRequest) {
  const gate = await requirePrivateOpsSession(request);
  if (gate instanceof NextResponse) return gate;

  const options = await listPrivateProjectTypeOptions();
  return NextResponse.json(options);
}
