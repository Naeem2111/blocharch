import {
	isAdminDashboardPath,
	isAthleteDashboardPath,
	isMarketingDashboardPath,
	isOpsDashboardPath,
} from "@/lib/permissions";
import { isAdminOnlyAccount } from "@/lib/admin-only-accounts";

/** Admin sidebar perspective — role-based console views. */
export type AdminConsoleView = "all" | "admin" | "manager" | "athlete";

export const ADMIN_CONSOLE_VIEWS: {
	id: AdminConsoleView;
	label: string;
	sections: readonly string[];
	home: string;
}[] = [
	{
		id: "all",
		label: "Show all",
		sections: [
			"marketing",
			"onboarding",
			"ops",
			"athlete_portal",
			"planner",
			"admin",
		],
		home: "/dashboard",
	},
	{
		id: "admin",
		label: "Admin",
		sections: ["onboarding", "ops", "planner", "admin"],
		home: "/dashboard/ops",
	},
	{
		id: "manager",
		label: "Manager",
		sections: ["marketing", "ops"],
		home: "/dashboard",
	},
	{
		id: "athlete",
		label: "Athlete",
		sections: ["athlete_portal"],
		home: "/dashboard/athlete",
	},
];

const LEGACY_VIEW_MAP: Record<string, AdminConsoleView> = {
	marketing: "manager",
	operations: "admin",
	planner: "admin",
};

export function canShowAdminConsoleViewSwitcher(user: {
	role: string;
}): boolean {
	return user.role === "admin";
}

export function adminConsoleViewsForUser(username: string) {
	if (isAdminOnlyAccount(username)) {
		return ADMIN_CONSOLE_VIEWS.filter((view) => view.id !== "athlete");
	}
	return ADMIN_CONSOLE_VIEWS;
}

const STORAGE_PREFIX = "blocharch.admin-view.v1:";

export function adminConsoleViewStorageKey(userId: string): string {
	return `${STORAGE_PREFIX}${userId}`;
}

export function isAdminConsoleView(value: string): value is AdminConsoleView {
	return ADMIN_CONSOLE_VIEWS.some((v) => v.id === value);
}

function normalizeStoredView(raw: string): AdminConsoleView | null {
	if (isAdminConsoleView(raw)) return raw;
	return LEGACY_VIEW_MAP[raw] ?? null;
}

export function adminViewFromPath(pathname: string): AdminConsoleView {
	if (isAdminDashboardPath(pathname)) return "admin";
	if (isAthleteDashboardPath(pathname)) return "athlete";
	if (pathname.startsWith("/dashboard/planner")) return "admin";
	if (isOpsDashboardPath(pathname)) return "admin";
	if (isMarketingDashboardPath(pathname)) return "manager";
	return "manager";
}

export function sectionsForAdminView(view: AdminConsoleView): readonly string[] {
	return (
		ADMIN_CONSOLE_VIEWS.find((v) => v.id === view)?.sections ??
		ADMIN_CONSOLE_VIEWS[0].sections
	);
}

export function homePathForAdminView(view: AdminConsoleView): string {
	return ADMIN_CONSOLE_VIEWS.find((v) => v.id === view)?.home ?? "/dashboard";
}

export function loadAdminConsoleView(userId: string): AdminConsoleView | null {
	if (typeof window === "undefined") return null;
	try {
		const raw = localStorage.getItem(adminConsoleViewStorageKey(userId));
		if (!raw) return null;
		return normalizeStoredView(raw);
	} catch {
		return null;
	}
}

export function saveAdminConsoleView(
	userId: string,
	view: AdminConsoleView,
): void {
	if (typeof window === "undefined") return;
	localStorage.setItem(adminConsoleViewStorageKey(userId), view);
}

/** Manager role sees ops overview only — same filter for admin "Manager" console view. */
export function useManagerOpsNavFilter(
	role: string,
	adminView: AdminConsoleView | null,
): boolean {
	return role === "manager" || adminView === "manager";
}
