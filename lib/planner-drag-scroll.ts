const EDGE_PX = 56;
const SCROLL_STEP = 14;

/** Auto-scroll planner kanban containers while dragging near edges. */
export function maybeAutoScrollDrag(clientX: number, clientY: number) {
  const nodes = Array.from(
    document.querySelectorAll("[data-planner-scroll-x], [data-planner-scroll-y]")
  );
  for (const el of nodes) {
    if (!(el instanceof HTMLElement)) continue;
    const rect = el.getBoundingClientRect();
    if (el.hasAttribute("data-planner-scroll-y")) {
      if (clientY >= rect.top && clientY <= rect.bottom) {
        if (clientY < rect.top + EDGE_PX) el.scrollTop -= SCROLL_STEP;
        else if (clientY > rect.bottom - EDGE_PX) el.scrollTop += SCROLL_STEP;
      }
    }
    if (el.hasAttribute("data-planner-scroll-x")) {
      if (clientX >= rect.left && clientX <= rect.right) {
        if (clientX < rect.left + EDGE_PX) el.scrollLeft -= SCROLL_STEP;
        else if (clientX > rect.right - EDGE_PX) el.scrollLeft += SCROLL_STEP;
      }
    }
  }
}
