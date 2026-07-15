import type { UserRole } from "@/lib/users-store";
import { isAdminOnlyAccount } from "@/lib/admin-only-accounts";

/** Admin accounts inherit manager + athlete staff capabilities. */
export function actsAsManager(role: UserRole): boolean {
	return role === "admin" || role === "manager";
}

export function actsAsAthlete(role: UserRole, username?: string): boolean {
	if (role === "user") return true;
	if (role === "admin" && username) return !isAdminOnlyAccount(username);
	return role === "admin";
}
