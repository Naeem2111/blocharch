"use client";

import { useEffect, useState } from "react";
import { DAILY_PROJECT_PHASE_OPTIONS, DAILY_TASK_TYPE_OPTIONS } from "@/lib/ops-daily-form";
import type { OpsCatalogOption } from "@/lib/ops-catalog-types";

export function useOpsCatalog() {
  const [phases, setPhases] = useState<OpsCatalogOption[]>(
    DAILY_PROJECT_PHASE_OPTIONS.map((opt) => ({
      id: null,
      value: opt.value,
      label: opt.label,
      builtInKey: opt.value,
      isBuiltIn: true,
    })),
  );
  const [workTypes, setWorkTypes] = useState<OpsCatalogOption[]>(
    DAILY_TASK_TYPE_OPTIONS.map((opt) => ({
      id: null,
      value: opt.value,
      label: opt.label,
      builtInKey: opt.value,
      isBuiltIn: true,
    })),
  );

  useEffect(() => {
    void fetch("/api/ops/catalog")
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) return;
        if (Array.isArray(j.phases) && j.phases.length > 0) setPhases(j.phases);
        if (Array.isArray(j.workTypes) && j.workTypes.length > 0) setWorkTypes(j.workTypes);
      })
      .catch(() => {});
  }, []);

  return { phases, workTypes };
}
