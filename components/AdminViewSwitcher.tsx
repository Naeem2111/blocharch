"use client";

import { useRouter } from "next/navigation";
import {
	adminConsoleViewsForUser,
	type AdminConsoleView,
	homePathForAdminView,
	saveAdminConsoleView,
} from "@/lib/admin-console-view";
import { isAdminOnlyAccount } from "@/lib/admin-only-accounts";

export function AdminViewSwitcher({
	userId,
	username,
	value,
	onChange,
	onNavigate,
}: {
	userId: string;
	username: string;
	value: AdminConsoleView;
	onChange: (view: AdminConsoleView) => void;
	onNavigate?: () => void;
}) {
	const router = useRouter();
	const views = adminConsoleViewsForUser(username);
	const adminOnly = isAdminOnlyAccount(username);

	function handleChange(next: AdminConsoleView) {
		if (next === value) return;
		saveAdminConsoleView(userId, next);
		onChange(next);
		if (next !== "all") {
			router.push(homePathForAdminView(next));
			onNavigate?.();
		}
	}

	return (
		<div className="rounded-lg bg-white/[0.03] px-3 py-2.5 ring-1 ring-white/[0.06]">
			<label className="block">
				<span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
					Console view
				</span>
				<select
					value={value}
					onChange={(e) => handleChange(e.target.value as AdminConsoleView)}
					className="field-console w-full rounded-lg px-3 py-2 text-sm text-slate-200"
					aria-label="Switch console view"
				>
					{views.map((view) => (
						<option key={view.id} value={view.id}>
							{view.label}
						</option>
					))}
				</select>
			</label>
			<p className="mt-2 text-[10px] leading-relaxed text-slate-600">
				{adminOnly
					? "Filter the sidebar by area. This account stays admin-only."
					: "Filter the sidebar by role perspective. Staff admins also have an athlete profile for assignment and reporting."}
			</p>
		</div>
	);
}
