import type { UserRole } from "@/lib/users-store";
import { isAdminOnlyAccount } from "@/lib/admin-only-accounts";

/** Feature areas within the single Blocharch console domain. */
export type AppModule =
  | "marketing"
  | "planner"
  | "admin"
  | "ops"
  | "athlete_portal"
  | "private_work";

const MODULE_ROLES: Record<AppModule, readonly UserRole[]> = {
  /** Lead directory, map, outreach — internal Blocharch staff only. */
  marketing: ["admin", "manager", "sales"],
  /** Kanban / project boards — all signed-in users. */
  planner: ["admin", "manager", "user"],
  /** User management and system settings. */
  admin: ["admin"],
  /** Athlete operations admin — clients, commercial, project tracker (/dashboard/ops). */
  ops: ["admin"],
  /** Athlete-facing workspace — dashboard, submissions, my projects (/dashboard/athlete). */
  athlete_portal: ["admin", "user"],
  /** Private Cape Town projects — ops overview (/dashboard/private). */
  private_work: ["admin"],
};

export function canAccessModule(
	role: UserRole,
	module: AppModule,
	username?: string | null,
): boolean {
	if (role === "admin") {
		if (username && isAdminOnlyAccount(username)) {
			if (module === "athlete_portal") return false;
			return MODULE_ROLES[module].includes("admin");
		}
		return true;
	}
	return MODULE_ROLES[module].includes(role);
}

/** Ops overview + athlete performance (managers) vs full ops console (admin). */
export function canAccessOpsOverview(role: UserRole): boolean {
  return role === "admin" || role === "manager";
}

export function canAccessOpsDashboardPath(role: UserRole, path: string): boolean {
  if (role === "admin" && canAccessModule(role, "ops")) return true;
  if (role === "manager") {
    return (
      path === "/dashboard/ops" ||
      path.startsWith("/dashboard/ops/pipeline") ||
      path === "/dashboard/ops/archives" ||
      path.startsWith("/dashboard/ops/archives/")
    );
  }
  return false;
}

export function canAccessOpsApiPath(role: UserRole, path: string): boolean {
  const normalized = path.split("?")[0] ?? path;
  if (role === "admin" && canAccessModule(role, "ops")) return true;
  if (role === "manager") {
    if (normalized === "/api/ops/overview") return true;
    if (normalized.startsWith("/api/ops/pipeline")) return true;
    if (normalized === "/api/ops/clients" || normalized === "/api/ops/athletes") return true;
    if (normalized === "/api/ops/archives") return true;
    if (/^\/api\/ops\/projects\/[^/]+\/reactivate$/.test(normalized)) return true;
    return false;
  }
  return false;
}

/** First screen after login for each role. */
export function defaultDashboardPath(
	role: UserRole,
	username?: string | null,
): string {
	if (canAccessModule(role, "marketing", username)) return "/dashboard";
	if (canAccessModule(role, "athlete_portal", username)) return "/dashboard/athlete";
	return "/dashboard/planner";
}

export function isMarketingDashboardPath(path: string): boolean {
  if (path === "/dashboard") return true;
  if (path.startsWith("/dashboard/practices")) return true;
  if (path.startsWith("/dashboard/map")) return true;
  if (path.startsWith("/dashboard/automation")) return true;
  if (path.startsWith("/dashboard/marketing")) return true;
  return false;
}

export function isMarketingApiPath(path: string): boolean {
  if (path.startsWith("/api/practices")) return true;
  if (path === "/api/stats") return true;
  if (path.startsWith("/api/leads")) return true;
  if (path.startsWith("/api/marketing")) return true;
  if (path.startsWith("/api/workflow")) return true;
  if (path === "/api/templates") return true;
  if (path.startsWith("/api/geocode")) return true;
  return false;
}

export function isPlannerDashboardPath(path: string): boolean {
  return path.startsWith("/dashboard/planner");
}

export function isPlannerApiPath(path: string): boolean {
  return path.startsWith("/api/planner/");
}

export function isAdminDashboardPath(path: string): boolean {
  return path.startsWith("/dashboard/admin");
}

export function isAdminApiPath(path: string): boolean {
  return path.startsWith("/api/admin/");
}

export function isOpsDashboardPath(path: string): boolean {
  return path === "/dashboard/ops" || path.startsWith("/dashboard/ops/");
}

export function isOpsApiPath(path: string): boolean {
  return path.startsWith("/api/ops/");
}

export function isAthleteDashboardPath(path: string): boolean {
  return path === "/dashboard/athlete" || path.startsWith("/dashboard/athlete/");
}

export function isAthleteApiPath(path: string): boolean {
  return path.startsWith("/api/athlete/");
}

export function isPrivateDashboardPath(path: string): boolean {
  return path === "/dashboard/private" || path.startsWith("/dashboard/private/");
}

export function isPrivateApiPath(path: string): boolean {
  return path.startsWith("/api/private/");
}

/** Unauthenticated client-portal actions (complete approvals, etc.). */
export function isPrivatePublicApiPath(path: string): boolean {
  return path.startsWith("/api/private/portal/");
}
