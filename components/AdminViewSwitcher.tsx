"use client";

import { useRouter } from "next/navigation";
import {
	ADMIN_CONSOLE_VIEWS,
	type AdminConsoleView,
	homePathForAdminView,
	saveAdminConsoleView,
} from "@/lib/admin-console-view";

export function AdminViewSwitcher({
	userId,
	value,
	onNavigate,
}: {
	userId: string;
	value: AdminConsoleView;
	onNavigate?: () => void;
}) {
	const router = useRouter();

	function handleChange(next: AdminConsoleView) {
		if (next === value) return;
		saveAdminConsoleView(userId, next);
		router.push(homePathForAdminView(next));
		onNavigate?.();
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
					{ADMIN_CONSOLE_VIEWS.map((view) => (
						<option key={view.id} value={view.id}>
							{view.label}
						</option>
					))}
				</select>
			</label>
			<p className="mt-2 text-[10px] leading-relaxed text-slate-600">
				Switch perspective — you still have full access to every area.
			</p>
		</div>
	);
}
