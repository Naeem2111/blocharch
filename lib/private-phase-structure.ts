import type { PrivateDesignStage } from "@prisma/client";
import { PRIVATE_STAGE_ORDER } from "@/lib/private-constants";

export type ProjectPhaseGroup = {
  id: string;
  name: string;
  stageKeys: PrivateDesignStage[];
};

export type PhaseStructure = {
  phases: ProjectPhaseGroup[];
};

export function defaultPhaseStructure(): PhaseStructure {
  return {
    phases: [
      {
        id: "phase-site",
        name: "Site & existing",
        stageKeys: ["site_measure_up", "existing_drawings"],
      },
      {
        id: "phase-concept",
        name: "Concept & review",
        stageKeys: ["concept_design", "design_review"],
      },
      {
        id: "phase-development",
        name: "Design development",
        stageKeys: ["design_development"],
      },
      {
        id: "phase-council",
        name: "Council submission",
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
    return { ok: false, error: "At least one phase is required." };
  }

  const seen = new Set<PrivateDesignStage>();
  for (const phase of structure.phases) {
    if (!phase.name.trim()) {
      return { ok: false, error: "Every phase needs a name." };
    }
    for (const stage of phase.stageKeys) {
      if (seen.has(stage)) {
        return { ok: false, error: "Each stage can only belong to one phase." };
      }
      seen.add(stage);
    }
  }

  for (const stage of PRIVATE_STAGE_ORDER) {
    if (!seen.has(stage)) {
      return { ok: false, error: "Every design stage must be assigned to a phase." };
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

export function addPhase(structure: PhaseStructure, name: string): PhaseStructure {
  return {
    phases: [
      ...structure.phases,
      {
        id: crypto.randomUUID(),
        name: name.trim() || "New phase",
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
