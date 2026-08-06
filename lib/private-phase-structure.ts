import type { PrivateDesignStage } from "@prisma/client";
import { PRIVATE_STAGE_LABELS, PRIVATE_STAGE_ORDER, stageIndex } from "@/lib/private-constants";

export type ProjectPhaseGroup = {
  id: string;
  name: string;
  stageKeys: PrivateDesignStage[];
};

export type PhaseStructure = {
  phases: ProjectPhaseGroup[];
};

export function defaultPhaseName(index: number): string {
  return `Stage ${index + 1}`;
}

export function defaultPhaseStructure(): PhaseStructure {
  return {
    phases: [
      {
        id: "phase-1",
        name: defaultPhaseName(0),
        stageKeys: ["site_measure_up", "existing_drawings"],
      },
      {
        id: "phase-2",
        name: defaultPhaseName(1),
        stageKeys: ["concept_design", "design_review"],
      },
      {
        id: "phase-3",
        name: defaultPhaseName(2),
        stageKeys: ["design_development"],
      },
      {
        id: "phase-4",
        name: defaultPhaseName(3),
        stageKeys: ["council_submission_docs", "council_review", "council_approved"],
      },
    ],
  };
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
    const stageKeysRaw = (item as { stageKeys?: unknown }).stageKeys;
    if (!id || !name || !Array.isArray(stageKeysRaw)) return null;
    const stageKeys = stageKeysRaw.map((k) => String(k)) as PrivateDesignStage[];
    if (stageKeys.some((k) => !PRIVATE_STAGE_ORDER.includes(k))) return null;
    phases.push({ id, name, stageKeys });
  }

  return { phases };
}

export function resolvePhaseStructure(json: unknown): PhaseStructure {
  return parsePhaseStructure(json) ?? defaultPhaseStructure();
}

export function validatePhaseStructure(structure: PhaseStructure): { ok: boolean; error?: string } {
  if (structure.phases.length === 0) {
    return { ok: false, error: "At least one stage is required." };
  }

  const seen = new Set<PrivateDesignStage>();
  for (const phase of structure.phases) {
    if (!phase.name.trim()) {
      return { ok: false, error: "Every stage needs a name." };
    }
    for (const stage of phase.stageKeys) {
      if (seen.has(stage)) {
        return { ok: false, error: "Each phase can only belong to one stage." };
      }
      seen.add(stage);
    }
  }

  for (const stage of PRIVATE_STAGE_ORDER) {
    if (!seen.has(stage)) {
      return { ok: false, error: "Every design phase must be assigned to a stage." };
    }
  }

  return { ok: true };
}

export function assignStageToPhase(
  structure: PhaseStructure,
  stage: PrivateDesignStage,
  targetPhaseId: string,
): PhaseStructure {
  return {
    phases: structure.phases.map((phase) => {
      const without = phase.stageKeys.filter((k) => k !== stage);
      if (phase.id === targetPhaseId) {
        const next = [...without, stage];
        next.sort(
          (a, b) => PRIVATE_STAGE_ORDER.indexOf(a) - PRIVATE_STAGE_ORDER.indexOf(b),
        );
        return { ...phase, stageKeys: next };
      }
      return { ...phase, stageKeys: without };
    }),
  };
}

export function addPhase(structure: PhaseStructure, name?: string): PhaseStructure {
  const nextIndex = structure.phases.length;
  return {
    phases: [
      ...structure.phases,
      {
        id: crypto.randomUUID(),
        name: name?.trim() || defaultPhaseName(nextIndex),
        stageKeys: [],
      },
    ],
  };
}

export function removePhase(structure: PhaseStructure, phaseId: string): PhaseStructure | null {
  const target = structure.phases.find((p) => p.id === phaseId);
  if (!target) return null;
  if (target.stageKeys.length > 0) return null;
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

export type PortalPhaseGroup = {
  id: string;
  name: string;
  number: number;
  state: "done" | "current" | "upcoming";
  stages: Array<{
    key: PrivateDesignStage;
    label: string;
    state: "done" | "current" | "upcoming";
  }>;
};

export function buildPortalPhaseGroups(
  structure: PhaseStructure,
  currentStage: PrivateDesignStage,
): PortalPhaseGroup[] {
  const currentIdx = stageIndex(currentStage);

  return structure.phases.map((phase, phaseIndex) => {
    const stageIndices = phase.stageKeys.map((key) => stageIndex(key));
    const minIdx = Math.min(...stageIndices);
    const maxIdx = Math.max(...stageIndices);

    let state: PortalPhaseGroup["state"] = "upcoming";
    if (maxIdx < currentIdx) state = "done";
    else if (minIdx <= currentIdx && currentIdx <= maxIdx) state = "current";

    return {
      id: phase.id,
      name: phase.name,
      number: phaseIndex + 1,
      state,
      stages: phase.stageKeys.map((key) => {
        const idx = stageIndex(key);
        return {
          key,
          label: PRIVATE_STAGE_LABELS[key],
          state:
            idx < currentIdx ? "done" : idx === currentIdx ? "current" : "upcoming",
        };
      }),
    };
  });
}
