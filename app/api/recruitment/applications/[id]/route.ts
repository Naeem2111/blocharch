import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { RecruitmentArchiveReason, RecruitmentAvailability, RecruitmentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canAccessModule } from "@/lib/permissions";
import { requireRecruitmentSession } from "@/lib/recruitment/access";
import { ACTIVE_RECRUITMENT_STATUSES } from "@/lib/recruitment/constants";
import { whatsAppHref } from "@/lib/recruitment/parse";
import { deleteRecruitmentSourceRow } from "@/lib/recruitment/sync";

type RouteContext = { params: Promise<{ id: string }> };

const STATUSES = new Set<string>(ACTIVE_RECRUITMENT_STATUSES.concat("archived"));
const AVAILABILITY = new Set(["full_time", "part_time", "after_hours", "unavailable", "needs_confirmation"]);
const REASONS = new Set(["not_suitable", "withdrew", "no_longer_interested", "duplicate", "other"]);

function serialize(row: NonNullable<Awaited<ReturnType<typeof load>>>) {
  return {
    id: row.id,
    fullName: row.fullName,
    email: row.email,
    phoneRaw: row.phoneRaw,
    phoneE164: row.phoneE164,
    whatsApp: whatsAppHref(row.phoneE164),
    phoneAmbiguous: Boolean(row.phoneRaw) && !row.phoneE164,
    location: row.location,
    software: row.software,
    softwareRaw: row.softwareRaw,
    experience: row.experience,
    experienceRaw: row.experienceRaw,
    experienceYears: row.experienceYears == null ? null : Number(row.experienceYears),
    availabilitySubmitted: row.availabilitySubmitted,
    confirmedAvailability: row.confirmedAvailability,
    availabilityNote: row.availabilityNote,
    availabilityUpdatedAt: row.availabilityUpdatedAt?.toISOString() ?? null,
    availabilityUpdatedByName: row.availabilityUpdatedByName,
    services: row.services,
    answers: row.answers,
    documents: row.documents,
    status: row.status,
    previousStatus: row.previousStatus,
    submittedAt: row.submittedAt?.toISOString() ?? null,
    archivedAt: row.archivedAt?.toISOString() ?? null,
    archiveReason: row.archiveReason,
    archiveComment: row.archiveComment,
    archivedByName: row.archivedByName,
    comments: row.comments.map((comment) => ({
      id: comment.id,
      authorName: comment.authorName,
      body: comment.body,
      fileLabel: comment.fileLabel,
      filePage: comment.filePage,
      createdAt: comment.createdAt.toISOString(),
    })),
    activity: row.activity.map((item) => ({
      id: item.id,
      actorName: item.actorName,
      action: item.action,
      detail: item.detail,
      createdAt: item.createdAt.toISOString(),
    })),
  };
}

function load(id: string) {
  return prisma.recruitmentApplication.findFirst({
    where: { id, removedFromSourceAt: null },
    include: {
      comments: { orderBy: { createdAt: "desc" } },
      activity: { orderBy: { createdAt: "desc" }, take: 40 },
    },
  });
}

export async function GET(request: NextRequest, context: RouteContext) {
  const gate = await requireRecruitmentSession(request);
  if (gate instanceof NextResponse) return gate;
  const { id } = await context.params;
  const row = await load(id);
  if (!row) return NextResponse.json({ error: "Application not found" }, { status: 404 });
  return NextResponse.json({
    application: serialize(row),
    canDelete: canAccessModule(gate.user.role, "admin", gate.user.username),
  });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const gate = await requireRecruitmentSession(request);
  if (gate instanceof NextResponse) return gate;
  const { id } = await context.params;
  const current = await prisma.recruitmentApplication.findFirst({ where: { id, removedFromSourceAt: null } });
  if (!current) return NextResponse.json({ error: "Application not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const actor = gate.user.username || "Staff";
  const data: {
    status?: RecruitmentStatus;
    previousStatus?: RecruitmentStatus | null;
    confirmedAvailability?: RecruitmentAvailability;
    availabilityNote?: string | null;
    availabilityUpdatedAt?: Date;
    availabilityUpdatedByName?: string;
    archivedAt?: Date | null;
    archiveReason?: RecruitmentArchiveReason | null;
    archiveComment?: string | null;
    archivedByName?: string | null;
  } = {};
  const notes: string[] = [];

  if (
    body.restore !== true &&
    body.archive !== true &&
    typeof body.status === "string" &&
    STATUSES.has(body.status) &&
    body.status !== current.status
  ) {
    if (body.status === "archived") {
      return NextResponse.json({ error: "Choose an archive reason." }, { status: 400 });
    }
    if (current.status === "archived") {
      return NextResponse.json({ error: "Restore the athlete instead of changing an archived status directly." }, { status: 400 });
    }
    data.status = body.status as RecruitmentStatus;
    notes.push(`Status set to ${body.status}`);
  }

  if (body.archive === true) {
    const reason = String(body.archiveReason ?? "");
    if (!REASONS.has(reason)) return NextResponse.json({ error: "Choose an archive reason." }, { status: 400 });
    data.previousStatus = current.status === "archived" ? current.previousStatus : current.status;
    data.status = "archived";
    data.archivedAt = new Date();
    data.archiveReason = reason as RecruitmentArchiveReason;
    data.archiveComment = body.archiveComment ? String(body.archiveComment).trim().slice(0, 2000) : null;
    data.archivedByName = actor;
    notes.push(`Archived (${reason})`);
  }

  if (body.restore === true) {
    const destination = typeof body.status === "string" && ACTIVE_RECRUITMENT_STATUSES.includes(body.status as RecruitmentStatus)
      ? (body.status as RecruitmentStatus)
      : current.previousStatus && current.previousStatus !== "archived"
        ? current.previousStatus
        : "to_review";
    data.status = destination;
    data.previousStatus = null;
    data.archivedAt = null;
    data.archiveReason = null;
    data.archiveComment = null;
    data.archivedByName = null;
    notes.push(`Restored to ${destination}`);
  }

  if (typeof body.confirmedAvailability === "string" && AVAILABILITY.has(body.confirmedAvailability)) {
    data.confirmedAvailability = body.confirmedAvailability as RecruitmentAvailability;
    data.availabilityUpdatedAt = new Date();
    data.availabilityUpdatedByName = actor;
    if (body.availabilityNote !== undefined) {
      data.availabilityNote = body.availabilityNote ? String(body.availabilityNote).trim().slice(0, 500) : null;
    }
    notes.push("Confirmed availability updated");
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.recruitmentApplication.update({ where: { id }, data }),
    ...notes.map((detail) =>
      prisma.recruitmentActivity.create({
        data: { applicationId: id, actorName: actor, action: "updated", detail },
      }),
    ),
  ]);

  const row = await load(id);
  return NextResponse.json({ application: row ? serialize(row) : null });
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const gate = await requireRecruitmentSession(request);
  if (gate instanceof NextResponse) return gate;
  if (!canAccessModule(gate.user.role, "admin", gate.user.username)) {
    return NextResponse.json({ error: "Only an admin can permanently delete an application." }, { status: 403 });
  }
  const { id } = await context.params;
  const current = await prisma.recruitmentApplication.findUnique({ where: { id } });
  if (!current) return NextResponse.json({ error: "Application not found" }, { status: 404 });
  const actor = gate.user.username || "Admin";
  try {
    await deleteRecruitmentSourceRow(current.sourceApplicationId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "The sheet row could not be deleted.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
  await prisma.$transaction([
    prisma.recruitmentSuppression.upsert({
      where: { sourceApplicationId: current.sourceApplicationId },
      create: { sourceApplicationId: current.sourceApplicationId, deletedByName: actor },
      update: { deletedByName: actor },
    }),
    prisma.recruitmentApplication.delete({ where: { id } }),
  ]);
  return NextResponse.json({
    ok: true,
    message: "Removed from recruitment and deleted from the Google Sheet. Drive files are unchanged.",
  });
}
