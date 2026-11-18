import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { Prisma, RecruitmentAvailability, RecruitmentExperience, RecruitmentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRecruitmentSession } from "@/lib/recruitment/access";
import { ACTIVE_RECRUITMENT_STATUSES } from "@/lib/recruitment/constants";
import { whatsAppHref } from "@/lib/recruitment/parse";
import { recruitmentSyncSummary, syncRecruitmentSheet } from "@/lib/recruitment/sync";

const STATUSES = new Set<string>([
  "to_review",
  "potential",
  "shortlisted",
  "onboarding",
  "on_bench",
  "live_active",
  "archived",
]);

export async function GET(request: NextRequest) {
  const gate = await requireRecruitmentSession(request);
  if (gate instanceof NextResponse) return gate;

  if (request.nextUrl.searchParams.get("refresh") === "1") {
    await syncRecruitmentSheet({ force: true });
  } else {
    await syncRecruitmentSheet();
  }

  const params = request.nextUrl.searchParams;
  const q = params.get("q")?.trim() ?? "";
  const status = params.get("status") || "all_active";
  const experience = params.get("experience") || "";
  const availability = params.get("availability") || "";
  const match = params.get("match") === "all" ? "all" : "any";
  const software = params.getAll("software").map((item) => item.trim()).filter(Boolean);
  const page = Math.max(1, Number(params.get("page")) || 1);
  const perPage = 25;

  const where: Prisma.RecruitmentApplicationWhereInput = { removedFromSourceAt: null };
  if (status === "all_active") where.status = { in: ACTIVE_RECRUITMENT_STATUSES };
  else if (status !== "all" && STATUSES.has(status)) where.status = status as RecruitmentStatus;
  if (experience && experience !== "all") where.experience = experience as RecruitmentExperience;
  if (availability && availability !== "all") where.confirmedAvailability = availability as RecruitmentAvailability;
  if (software.length > 0) {
    where.software = match === "all" ? { hasEvery: software } : { hasSome: software };
  }
  if (q) {
    where.OR = [
      { fullName: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { phoneRaw: { contains: q, mode: "insensitive" } },
      { location: { contains: q, mode: "insensitive" } },
      { softwareRaw: { contains: q, mode: "insensitive" } },
      { services: { contains: q, mode: "insensitive" } },
    ];
  }

  const [total, rows, softwareRows, sync] = await Promise.all([
    prisma.recruitmentApplication.count({ where }),
    prisma.recruitmentApplication.findMany({
      where,
      orderBy: [{ submittedAt: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.recruitmentApplication.findMany({
      where: { removedFromSourceAt: null },
      select: { software: true },
    }),
    recruitmentSyncSummary(),
  ]);

  const softwareOptions = Array.from(new Set(softwareRows.flatMap((row) => row.software))).sort((a, b) =>
    a.localeCompare(b),
  );

  return NextResponse.json({
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / perPage)),
    sync,
    softwareOptions,
    applications: rows.map((row) => ({
      id: row.id,
      fullName: row.fullName,
      email: row.email,
      phoneRaw: row.phoneRaw,
      phoneE164: row.phoneE164,
      whatsApp: whatsAppHref(row.phoneE164),
      phoneAmbiguous: Boolean(row.phoneRaw) && !row.phoneE164,
      location: row.location,
      software: row.software,
      experience: row.experience,
      experienceYears: row.experienceYears == null ? null : Number(row.experienceYears),
      confirmedAvailability: row.confirmedAvailability,
      availabilityNote: row.availabilityNote,
      availabilitySubmitted: row.availabilitySubmitted,
      status: row.status,
      previousStatus: row.previousStatus,
      submittedAt: row.submittedAt?.toISOString() ?? null,
      archivedAt: row.archivedAt?.toISOString() ?? null,
      archiveReason: row.archiveReason,
    })),
  });
}
