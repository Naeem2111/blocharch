import {
	isAdminDashboardPath,
	isAthleteDashboardPath,
	isMarketingDashboardPath,
	isOpsDashboardPath,
} from "@/lib/permissions";
import { isAdminOnlyAccount } from "@/lib/admin-only-accounts";

/** Admin-only sidebar perspective — one role view at a time. */
export type AdminConsoleView =
	| "all"
	| "marketing"
	| "operations"
	| "athlete"
	| "planner"
	| "admin";

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
		id: "marketing",
		label: "Marketing",
		sections: ["marketing"],
		home: "/dashboard",
	},
	{
		id: "operations",
		label: "Athlete operations",
		sections: ["onboarding", "ops"],
		home: "/dashboard/ops",
	},
	{
		id: "athlete",
		label: "My workspace",
		sections: ["athlete_portal"],
		home: "/dashboard/athlete",
	},
	{
		id: "planner",
		label: "Project planner",
		sections: ["planner"],
		home: "/dashboard/planner",
	},
	{
		id: "admin",
		label: "Users & access",
		sections: ["admin"],
		home: "/dashboard/admin",
	},
];

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

export function adminViewFromPath(pathname: string): AdminConsoleView {
	if (isAdminDashboardPath(pathname)) return "admin";
	if (isAthleteDashboardPath(pathname)) return "athlete";
	if (pathname.startsWith("/dashboard/planner")) return "planner";
	if (isOpsDashboardPath(pathname)) return "operations";
	if (isMarketingDashboardPath(pathname)) return "marketing";
	return "marketing";
}

export function sectionsForAdminView(view: AdminConsoleView): readonly string[] {
	if (view === "all") {
		return ADMIN_CONSOLE_VIEWS[0].sections;
	}
	return (
		ADMIN_CONSOLE_VIEWS.find((v) => v.id === view)?.sections ?? ["marketing"]
	);
}

export function homePathForAdminView(view: AdminConsoleView): string {
	return ADMIN_CONSOLE_VIEWS.find((v) => v.id === view)?.home ?? "/dashboard";
}

export function loadAdminConsoleView(userId: string): AdminConsoleView | null {
	if (typeof window === "undefined") return null;
	try {
		const raw = localStorage.getItem(adminConsoleViewStorageKey(userId));
		if (!raw || !isAdminConsoleView(raw)) return null;
		return raw;
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
