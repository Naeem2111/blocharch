import type { PrivateDesignStage } from "@prisma/client";
import { PRIVATE_STAGE_LABELS, PRIVATE_STAGE_ORDER, stageIndex } from "@/lib/private-constants";

/** User-defined design phase within a stage group. */
export type ProjectDesignPhase = {
  id: string;
  name: string;
  /** Links to built-in workflow step for progress and expense attribution. */
  builtInKey?: PrivateDesignStage;
};

export type ProjectPhaseGroup = {
  id: string;
  name: string;
  designPhases: ProjectDesignPhase[];
  /** When set, fee is allocated to child phases — no per-phase entry needed. */
  feePercent?: number;
};

export type PhaseStructure = {
  phases: ProjectPhaseGroup[];
};

export function defaultPhaseName(index: number): string {
  return `Stage ${index + 1}`;
}

export function defaultDesignPhaseName(index: number): string {
  return `Phase ${index + 1}`;
}

function designPhasesFromStageKeys(stageKeys: PrivateDesignStage[]): ProjectDesignPhase[] {
  return stageKeys.map((key) => ({
    id: key,
    name: PRIVATE_STAGE_LABELS[key],
    builtInKey: key,
  }));
}

export function defaultPhaseStructure(): PhaseStructure {
  return {
    phases: [
      {
        id: "phase-1",
        name: defaultPhaseName(0),
        designPhases: designPhasesFromStageKeys(["site_measure_up", "existing_drawings"]),
      },
      {
        id: "phase-2",
        name: defaultPhaseName(1),
        designPhases: designPhasesFromStageKeys(["concept_design", "design_review"]),
      },
      {
        id: "phase-3",
        name: defaultPhaseName(2),
        designPhases: designPhasesFromStageKeys(["design_development"]),
      },
      {
        id: "phase-4",
        name: defaultPhaseName(3),
        designPhases: designPhasesFromStageKeys([
          "council_submission_docs",
          "council_review",
          "council_approved",
        ]),
      },
    ],
  };
}

function parseDesignPhases(raw: unknown): ProjectDesignPhase[] | null {
  if (!Array.isArray(raw)) return null;
  const phases: ProjectDesignPhase[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") return null;
    const id = String((item as { id?: unknown }).id || "").trim();
    const name = String((item as { name?: unknown }).name || "").trim();
    if (!id || !name) return null;
    const builtInRaw = (item as { builtInKey?: unknown }).builtInKey;
    let builtInKey: PrivateDesignStage | undefined;
    if (builtInRaw != null && builtInRaw !== "") {
      const key = String(builtInRaw) as PrivateDesignStage;
      if (!PRIVATE_STAGE_ORDER.includes(key)) return null;
      builtInKey = key;
    }
    phases.push(builtInKey ? { id, name, builtInKey } : { id, name });
  }
  return phases;
}

export function parsePhaseStructure(json: unknown): PhaseStructure | null {
  if (!json || typeof json !== "object") return null;
  const phasesRaw = (json as { phases?: unknown }).phases;
  if (!Array.isArray(phasesRaw) || phasesRaw.length === 0) return null;

  const phases: ProjectPhaseGroup[] = [];
  for (const item of phasesRaw) {
    if (!item || typeof item !== "object") return null;
    const id = String((item as { id?: unknown }).id || "").trim();
    const name = String((item as { name?: unknown }).name || "").trim();
    if (!id || !name) return null;

    const designPhasesRaw = (item as { designPhases?: unknown }).designPhases;
    const stageKeysRaw = (item as { stageKeys?: unknown }).stageKeys;
    let designPhases: ProjectDesignPhase[] | null = null;
    if (designPhasesRaw != null) {
      designPhases = parseDesignPhases(designPhasesRaw);
    } else if (Array.isArray(stageKeysRaw)) {
      const stageKeys = stageKeysRaw.map((k) => String(k)) as PrivateDesignStage[];
      if (stageKeys.some((k) => !PRIVATE_STAGE_ORDER.includes(k))) return null;
      designPhases = designPhasesFromStageKeys(stageKeys);
    }
    if (!designPhases) return null;

    const feePercentRaw = (item as { feePercent?: unknown }).feePercent;
    let feePercent: number | undefined;
    if (feePercentRaw !== undefined && feePercentRaw !== null) {
      const n = Number(feePercentRaw);
      if (!Number.isFinite(n) || n < 0 || n > 100) return null;
      feePercent = Math.round(n);
    }
    phases.push({ id, name, designPhases, ...(feePercent !== undefined ? { feePercent } : {}) });
  }

  return { phases };
}

export function resolvePhaseStructure(json: unknown): PhaseStructure {
  return parsePhaseStructure(json) ?? defaultPhaseStructure();
}

export function allDesignPhases(structure: PhaseStructure): ProjectDesignPhase[] {
  return structure.phases.flatMap((group) => group.designPhases);
}

export function findDesignPhase(
  structure: PhaseStructure,
  phaseId: string,
): { group: ProjectPhaseGroup; phase: ProjectDesignPhase } | null {
  for (const group of structure.phases) {
    const phase = group.designPhases.find((p) => p.id === phaseId);
    if (phase) return { group, phase };
  }
  return null;
}

export function validatePhaseStructure(structure: PhaseStructure): { ok: boolean; error?: string } {
  if (structure.phases.length === 0) {
    return { ok: false, error: "At least one stage is required." };
  }

  const seenIds = new Set<string>();
  for (const group of structure.phases) {
    if (!group.name.trim()) {
      return { ok: false, error: "Every stage needs a name." };
    }
    for (const phase of group.designPhases) {
      if (!phase.name.trim()) {
        return { ok: false, error: "Every phase needs a name." };
      }
      if (seenIds.has(phase.id)) {
        return { ok: false, error: "Phase IDs must be unique." };
      }
      seenIds.add(phase.id);
    }
  }

  if (allDesignPhases(structure).length === 0) {
    return { ok: false, error: "Add at least one design phase." };
  }

  return { ok: true };
}

export function addPhase(structure: PhaseStructure, name?: string): PhaseStructure {
  const nextIndex = structure.phases.length;
  return {
    phases: [
      ...structure.phases,
      {
        id: crypto.randomUUID(),
        name: name?.trim() || defaultPhaseName(nextIndex),
        designPhases: [],
      },
    ],
  };
}

export function removePhase(structure: PhaseStructure, phaseId: string): PhaseStructure | null {
  const target = structure.phases.find((p) => p.id === phaseId);
  if (!target) return null;
  if (target.designPhases.length > 0) return null;
  if (structure.phases.length <= 1) return null;
  return { phases: structure.phases.filter((p) => p.id !== phaseId) };
}

export function renamePhase(
  structure: PhaseStructure,
  phaseId: string,
  name: string,
): PhaseStructure {
  return {
    phases: structure.phases.map((p) =>
      p.id === phaseId ? { ...p, name: name.trim() || p.name } : p,
    ),
  };
}

export function addDesignPhase(
  structure: PhaseStructure,
  groupId: string,
  name?: string,
): PhaseStructure {
  const nextIndex = allDesignPhases(structure).length;
  const phase: ProjectDesignPhase = {
    id: crypto.randomUUID(),
    name: name?.trim() || defaultDesignPhaseName(nextIndex),
  };
  return {
    phases: structure.phases.map((group) =>
      group.id === groupId
        ? { ...group, designPhases: [...group.designPhases, phase], feePercent: undefined }
        : group,
    ),
  };
}

export function renameDesignPhase(
  structure: PhaseStructure,
  phaseId: string,
  name: string,
): PhaseStructure {
  return {
    phases: structure.phases.map((group) => ({
      ...group,
      designPhases: group.designPhases.map((p) =>
        p.id === phaseId ? { ...p, name: name.trim() || p.name } : p,
      ),
    })),
  };
}

export function removeDesignPhase(
  structure: PhaseStructure,
  phaseId: string,
): PhaseStructure | null {
  if (allDesignPhases(structure).length <= 1) return null;
  return {
    phases: structure.phases.map((group) => ({
      ...group,
      designPhases: group.designPhases.filter((p) => p.id !== phaseId),
    })),
  };
}

export function moveDesignPhaseToGroup(
  structure: PhaseStructure,
  phaseId: string,
  targetGroupId: string,
): PhaseStructure {
  const found = findDesignPhase(structure, phaseId);
  if (!found) return structure;
  const without = structure.phases.map((group) => ({
    ...group,
    designPhases: group.designPhases.filter((p) => p.id !== phaseId),
  }));
  return {
    phases: without.map((group) =>
      group.id === targetGroupId
        ? { ...group, designPhases: [...group.designPhases, found.phase], feePercent: undefined }
        : group,
    ),
  };
}

export function setPhaseGroupFeePercent(
  structure: PhaseStructure,
  phaseId: string,
  feePercent: number,
): PhaseStructure {
  const rounded = Math.max(0, Math.min(100, Math.round(feePercent)));
  return {
    phases: structure.phases.map((p) =>
      p.id === phaseId ? { ...p, feePercent: rounded } : p,
    ),
  };
}

export function clearPhaseGroupFeePercent(
  structure: PhaseStructure,
  phaseId: string,
): PhaseStructure {
  return {
    phases: structure.phases.map((p) =>
      p.id === phaseId ? { ...p, feePercent: undefined } : p,
    ),
  };
}

export function phaseGroupFeeTotal(
  group: ProjectPhaseGroup,
  phaseFeePercents: Record<string, number>,
): number {
  return group.designPhases.reduce((sum, phase) => sum + (phaseFeePercents[phase.id] ?? 0), 0);
}

export type PortalPhaseGroup = {
  id: string;
  name: string;
  number: number;
  state: "done" | "current" | "upcoming";
  stages: Array<{
    key: string;
    label: string;
    state: "done" | "current" | "upcoming";
  }>;
};

export function buildPortalPhaseGroups(
  structure: PhaseStructure,
  currentStage: PrivateDesignStage,
): PortalPhaseGroup[] {
  const currentIdx = stageIndex(currentStage);

  return structure.phases.map((group, groupIndex) => {
    const builtInIndices = group.designPhases
      .map((p) => (p.builtInKey ? stageIndex(p.builtInKey) : null))
      .filter((idx): idx is number => idx != null);

    let state: PortalPhaseGroup["state"] = "upcoming";
    if (builtInIndices.length > 0) {
      const minIdx = Math.min(...builtInIndices);
      const maxIdx = Math.max(...builtInIndices);
      if (maxIdx < currentIdx) state = "done";
      else if (minIdx <= currentIdx && currentIdx <= maxIdx) state = "current";
    }

    return {
      id: group.id,
      name: group.name,
      number: groupIndex + 1,
      state,
      stages: group.designPhases.map((phase) => {
        const idx = phase.builtInKey ? stageIndex(phase.builtInKey) : null;
        return {
          key: phase.id,
          label: phase.name,
          state:
            idx == null
              ? state
              : idx < currentIdx
                ? "done"
                : idx === currentIdx
                  ? "current"
                  : "upcoming",
        };
      }),
    };
  });
}
