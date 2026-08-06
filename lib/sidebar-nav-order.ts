export type SidebarNavOrder = {
  sections: string[];
  items: Record<string, string[]>;
  /** Section ids that are collapsed in the sidebar. */
  collapsedSections?: string[];
};

const STORAGE_PREFIX = "blocharch.sidebar-order.v1:";

export function sidebarNavStorageKey(userId: string): string {
  return `${STORAGE_PREFIX}${userId}`;
}

export function parseSidebarNavOrder(raw: unknown): SidebarNavOrder | null {
  if (!raw || typeof raw !== "object") return null;
  const parsed = raw as Partial<SidebarNavOrder>;
  return {
    sections: Array.isArray(parsed.sections)
      ? parsed.sections.filter((id): id is string => typeof id === "string")
      : [],
    items:
      parsed.items && typeof parsed.items === "object"
        ? Object.fromEntries(
            Object.entries(parsed.items).filter(
              (entry): entry is [string, string[]] =>
                typeof entry[0] === "string" &&
                Array.isArray(entry[1]) &&
                entry[1].every((h) => typeof h === "string")
            )
          )
        : {},
    collapsedSections: Array.isArray(parsed.collapsedSections)
      ? parsed.collapsedSections.filter((id): id is string => typeof id === "string")
      : [],
  };
}

export function loadSidebarNavOrder(userId: string): SidebarNavOrder | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(sidebarNavStorageKey(userId));
    if (!raw) return null;
    return parseSidebarNavOrder(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveSidebarNavOrder(userId: string, order: SidebarNavOrder): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(sidebarNavStorageKey(userId), JSON.stringify(order));
}

export function applySectionOrder<T extends { id: string }>(
  sections: T[],
  order: string[] | null | undefined
): T[] {
  if (!order?.length) return sections;
  const map = new Map(sections.map((s) => [s.id, s]));
  const out: T[] = [];
  for (const id of order) {
    const s = map.get(id);
    if (s) {
      out.push(s);
      map.delete(id);
    }
  }
  for (const s of Array.from(map.values())) out.push(s);
  return out;
}

export function applyItemOrder<T extends { href: string }>(
  items: T[],
  order: string[] | null | undefined
): T[] {
  if (!order?.length) return items;
  const map = new Map(items.map((i) => [i.href, i]));
  const out: T[] = [];
  for (const href of order) {
    const item = map.get(href);
    if (item) {
      out.push(item);
      map.delete(href);
    }
  }
  for (const item of Array.from(map.values())) out.push(item);
  return out;
}

export function reorderIds(ids: string[], fromIndex: number, toIndex: number): string[] {
  if (
    fromIndex === toIndex ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= ids.length ||
    toIndex >= ids.length
  ) {
    return ids;
  }
  const next = [...ids];
  const [removed] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, removed);
  return next;
}

/** Default href lists per section id. */
export function defaultItemsBySection(
  sections: { id: string; items: { href: string }[] }[]
): Record<string, string[]> {
  return Object.fromEntries(sections.map((s) => [s.id, s.items.map((i) => i.href)]));
}

/**
 * Merge saved item placements with defaults. Saved lists may move links between sections.
 * Hrefs must exist in `accessibleHrefs` to appear (role / view filtered).
 */
export function resolveItemsBySection(
  sectionIds: string[],
  defaults: Record<string, string[]>,
  saved: Record<string, string[]> | undefined,
  accessibleHrefs: Set<string>
): Record<string, string[]> {
  const filterKnown = (hrefs: string[]) =>
    hrefs.filter((href) => accessibleHrefs.has(href));

  if (!saved || Object.keys(saved).length === 0) {
    return Object.fromEntries(
      sectionIds.map((id) => [id, filterKnown(defaults[id] ?? [])])
    );
  }

  const homeByHref = new Map<string, string>();
  for (const id of sectionIds) {
    for (const href of defaults[id] ?? []) {
      homeByHref.set(href, id);
    }
  }

  const assigned = new Set<string>();
  const result: Record<string, string[]> = Object.fromEntries(
    sectionIds.map((id) => [id, [] as string[]])
  );

  for (const id of sectionIds) {
    const list = saved[id];
    if (!list) continue;
    for (const href of list) {
      if (assigned.has(href) || !accessibleHrefs.has(href)) continue;
      result[id].push(href);
      assigned.add(href);
    }
  }

  for (const id of sectionIds) {
    for (const href of defaults[id] ?? []) {
      if (!assigned.has(href) && accessibleHrefs.has(href)) {
        result[id].push(href);
        assigned.add(href);
      }
    }
  }

  return result;
}

export function moveNavItem(
  itemsBySection: Record<string, string[]>,
  fromSection: string,
  fromIndex: number,
  toSection: string,
  toIndex: number
): Record<string, string[]> {
  const fromList = [...(itemsBySection[fromSection] ?? [])];
  if (fromIndex < 0 || fromIndex >= fromList.length) return itemsBySection;

  if (fromSection === toSection) {
    return {
      ...itemsBySection,
      [fromSection]: reorderIds(fromList, fromIndex, toIndex),
    };
  }

  const [href] = fromList.splice(fromIndex, 1);
  if (!href) return itemsBySection;

  const toList = [...(itemsBySection[toSection] ?? [])];
  const clampedIndex = Math.max(0, Math.min(toIndex, toList.length));
  toList.splice(clampedIndex, 0, href);

  return {
    ...itemsBySection,
    [fromSection]: fromList,
    [toSection]: toList,
  };
}
