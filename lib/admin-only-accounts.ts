/** Admin accounts that stay admin-only — no athlete portal and no staff athlete profile. */
const ADMIN_ONLY_USERNAMES = new Set<string>([]);

export function isAdminOnlyAccount(username: string): boolean {
	return ADMIN_ONLY_USERNAMES.has(username.trim().toLowerCase());
}

/** Admin who can be assigned work and appear in athlete reporting. */
export function isStaffAdmin(user: { role: string; username: string }): boolean {
	return user.role === "admin" && !isAdminOnlyAccount(user.username);
}
