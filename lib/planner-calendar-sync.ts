import { Prisma } from "@prisma/client";
import {
  createGoogleCalendarEvent,
  deleteGoogleCalendarEvent,
  getGoogleCalendarConfig,
  patchGoogleCalendarEvent,
} from "@/lib/google-calendar";
import { prisma } from "@/lib/prisma";

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return { ...(value as Record<string, unknown>) };
}

function eventIdFrom(fields: Record<string, unknown>): string | null {
  const id = fields.googleCalendarEventId;
  return typeof id === "string" && id.trim() ? id : null;
}

/** Writes a planner card's due date onto the connected Google Calendar. No-op when Calendar is not configured. */
export async function syncPlannerTaskToGoogleCalendar(taskId: string): Promise<void> {
  if (!getGoogleCalendarConfig()) return;

  const task = await prisma.plannerTask.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      title: true,
      summary: true,
      description: true,
      dueAt: true,
      customFields: true,
    },
  });
  if (!task) return;

  const fields = asRecord(task.customFields);
  const existingId = eventIdFrom(fields);
  const description = [task.summary, task.description].filter(Boolean).join("\n\n");

  try {
    if (!task.dueAt) {
      if (!existingId) return;
      await deleteGoogleCalendarEvent(existingId);
      delete fields.googleCalendarEventId;
      await prisma.plannerTask.update({
        where: { id: taskId },
        data: { customFields: fields as Prisma.InputJsonValue },
      });
      return;
    }

    const end = new Date(task.dueAt.getTime() + 60 * 60 * 1000);
    if (existingId) {
      try {
        await patchGoogleCalendarEvent(existingId, {
          summary: task.title,
          description,
          start: task.dueAt,
          end,
        });
        return;
      } catch (error) {
        console.error("planner calendar update failed, creating a new event", error);
      }
    }

    const created = await createGoogleCalendarEvent({
      title: task.title,
      description: description || "Blocharch planner",
      start: task.dueAt,
      end,
    });
    if (!created) return;

    fields.googleCalendarEventId = created.eventId;
    await prisma.plannerTask.update({
      where: { id: taskId },
      data: { customFields: fields as Prisma.InputJsonValue },
    });
  } catch (error) {
    console.error("planner calendar sync failed", error);
  }
}
