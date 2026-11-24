import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOpsSession } from "@/lib/ops-access";
import { isRecruitmentSheetConfigured, listRecruitApplicants } from "@/lib/recruitment-sheet";

export async function GET(request: NextRequest) {
  const gate = await requireOpsSession(request);
  if (gate instanceof NextResponse) return gate;

  try {
    const [applicants, athletes] = await Promise.all([
      listRecruitApplicants(),
      prisma.opsAthlete.findMany({ select: { email: true } }),
    ]);
    const onboarded = new Set(
      athletes.map((athlete) => athlete.email?.trim().toLowerCase()).filter((email): email is string => Boolean(email)),
    );
    return NextResponse.json({
      canDelete: isRecruitmentSheetConfigured(),
      applicants: applicants.map((applicant) => ({
        ...applicant,
        onboarded:
          onboarded.has(applicant.email.toLowerCase()) ||
          (applicant.emailAlt ? onboarded.has(applicant.emailAlt.toLowerCase()) : false),
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not read the recruitment sheet.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
