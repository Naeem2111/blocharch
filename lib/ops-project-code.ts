import type { PrismaClient } from "@prisma/client";

export function normalizeAthleteProjectCode(code: string): string {
  return code.trim();
}

type CodeCheckParams = {
  code: string;
  clientId: string;
  assignedAthleteId?: string | null;
  excludeProjectId?: string;
};

type ProjectRow = { id: string; clientId: string; projectNumber: string };
type AthleteRow = { id: string; fullName: string; athleteCode: string };

export function validateAthleteProjectCodeLocal(
  params: CodeCheckParams & { projects: ProjectRow[]; athletes: AthleteRow[] }
): string | null {
  const code = normalizeAthleteProjectCode(params.code);
  if (!code) return "Athlete code is required";

  const projectConflict = params.projects.find(
    (p) =>
      p.clientId === params.clientId &&
      p.projectNumber === code &&
      p.id !== params.excludeProjectId
  );
  if (projectConflict) {
    return "This athlete code is already used for another project on this client.";
  }

  const athleteConflict = params.athletes.find(
    (a) => a.athleteCode === code && a.id !== (params.assignedAthleteId || undefined)
  );
  if (athleteConflict) {
    return `This code is already assigned to athlete ${athleteConflict.fullName}.`;
  }

  return null;
}

export async function validateAthleteProjectCodeDb(
  prisma: PrismaClient,
  params: CodeCheckParams
): Promise<string | null> {
  const code = normalizeAthleteProjectCode(params.code);
  if (!code) return "Athlete code is required";

  const projectConflict = await prisma.opsProject.findFirst({
    where: {
      clientId: params.clientId,
      projectNumber: code,
      ...(params.excludeProjectId ? { id: { not: params.excludeProjectId } } : {}),
    },
    select: { id: true },
  });
  if (projectConflict) {
    return "This athlete code is already used for another project on this client.";
  }

  const athleteWithCode = await prisma.opsAthlete.findUnique({
    where: { athleteCode: code },
    select: { id: true, fullName: true },
  });
  if (athleteWithCode && athleteWithCode.id !== params.assignedAthleteId) {
    return `This code is already assigned to athlete ${athleteWithCode.fullName}.`;
  }

  return null;
}
