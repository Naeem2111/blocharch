import path from "path";
import fs from "fs";
import { randomUUID } from "crypto";
import { hashPassword } from "@/lib/password";

export type UserRole = "admin" | "user";

export interface UserRecord {
  id: string;
  username: string;
  passwordHash: string;
  role: UserRole;
  disabled?: boolean;
  createdAt: string;
}

interface UsersFile {
  users: UserRecord[];
}

/** Writable path for users.json. Vercel serverless FS is read-only except /tmp. */
function getUsersFilePath(): string {
  const override = process.env.BLOCHARCH_USERS_FILE?.trim();
  if (override) return path.isAbsolute(override) ? override : path.join(process.cwd(), override);
  if (process.env.VERCEL) return path.join("/tmp", "blocarch-users.json");
  return path.join(process.cwd(), "data", "users.json");
}

function ensureUsersDir(): void {
  const dir = path.dirname(getUsersFilePath());
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function defaultBootstrapCreds(): { username: string; password: string } {
  const username = (process.env.BLOCHARCH_ADMIN_USERNAME || "blocharch").trim().toLowerCase();
  const password = (process.env.BLOCHARCH_ADMIN_PASSWORD || "blocharch").trim();
  return { username, password };
}

function bootstrapIfEmpty(): UsersFile {
  const { username, password } = defaultBootstrapCreds();
  const now = new Date().toISOString();
  const admin: UserRecord = {
    id: randomUUID(),
    username,
    passwordHash: hashPassword(password),
    role: "admin",
    createdAt: now,
  };
  return { users: [admin] };
}

export function loadUsersFile(): UsersFile {
  const usersFile = getUsersFilePath();
  ensureUsersDir();
  if (!fs.existsSync(usersFile)) {
    const initial = bootstrapIfEmpty();
    saveUsersFile(initial);
    return initial;
  }
  try {
    const raw = fs.readFileSync(usersFile, "utf-8");
    const parsed = JSON.parse(raw) as UsersFile;
    if (!parsed || !Array.isArray(parsed.users)) {
      const initial = bootstrapIfEmpty();
      saveUsersFile(initial);
      return initial;
    }
    if (parsed.users.length === 0) {
      const initial = bootstrapIfEmpty();
      saveUsersFile(initial);
      return initial;
    }
    return parsed;
  } catch {
    const initial = bootstrapIfEmpty();
    saveUsersFile(initial);
    return initial;
  }
}

export function saveUsersFile(data: UsersFile): void {
  ensureUsersDir();
  fs.writeFileSync(getUsersFilePath(), JSON.stringify(data, null, 2), "utf-8");
}

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

export function findUserByUsername(username: string): UserRecord | null {
  const u = normalizeUsername(username);
  const { users } = loadUsersFile();
  return users.find((x) => x.username === u) ?? null;
}

export function findUserById(id: string): UserRecord | null {
  const { users } = loadUsersFile();
  return users.find((x) => x.id === id) ?? null;
}

export function listUsersPublic(): Omit<UserRecord, "passwordHash">[] {
  const { users } = loadUsersFile();
  return users.map(({ passwordHash: _, ...rest }) => rest);
}

export function countAdmins(): number {
  const { users } = loadUsersFile();
  return users.filter((x) => x.role === "admin" && !x.disabled).length;
}

export function createUser(input: {
  username: string;
  password: string;
  role: UserRole;
  disabled?: boolean;
}): { ok: true; user: Omit<UserRecord, "passwordHash"> } | { ok: false; error: string } {
  const username = normalizeUsername(input.username);
  if (username.length < 2 || username.length > 64) {
    return { ok: false, error: "Username must be 2–64 characters" };
  }
  if (!/^[a-z0-9_@.-]+$/.test(username)) {
    return { ok: false, error: "Username may only contain letters, digits, _ @ . -" };
  }
  if (input.password.length < 6) {
    return { ok: false, error: "Password must be at least 6 characters" };
  }
  const file = loadUsersFile();
  if (file.users.some((x) => x.username === username)) {
    return { ok: false, error: "Username already exists" };
  }
  const user: UserRecord = {
    id: randomUUID(),
    username,
    passwordHash: hashPassword(input.password),
    role: input.role,
    disabled: input.disabled ?? false,
    createdAt: new Date().toISOString(),
  };
  file.users.push(user);
  saveUsersFile(file);
  const { passwordHash: _, ...pub } = user;
  return { ok: true, user: pub };
}

export function updateUser(
  id: string,
  patch: { password?: string; role?: UserRole; disabled?: boolean },
  actorId: string
): { ok: true; user: Omit<UserRecord, "passwordHash"> } | { ok: false; error: string } {
  const file = loadUsersFile();
  const idx = file.users.findIndex((x) => x.id === id);
  if (idx < 0) return { ok: false, error: "User not found" };
  const current = file.users[idx];

  if (patch.password !== undefined) {
    if (patch.password.length < 6) {
      return { ok: false, error: "Password must be at least 6 characters" };
    }
    current.passwordHash = hashPassword(patch.password);
  }

  if (patch.role !== undefined && patch.role !== current.role) {
    if (current.role === "admin" && patch.role !== "admin") {
      const otherActiveAdmins = file.users.filter(
        (x) => x.role === "admin" && !x.disabled && x.id !== current.id
      );
      if (otherActiveAdmins.length === 0) {
        return { ok: false, error: "Cannot demote the last admin" };
      }
    }
    current.role = patch.role;
  }

  if (patch.disabled !== undefined && patch.disabled !== !!current.disabled) {
    if (current.id === actorId && patch.disabled) {
      return { ok: false, error: "You cannot disable your own account" };
    }
    if (current.role === "admin" && patch.disabled) {
      const otherActiveAdmins = file.users.filter(
        (x) => x.role === "admin" && !x.disabled && x.id !== current.id
      );
      if (otherActiveAdmins.length === 0) {
        return { ok: false, error: "Cannot disable the only active admin" };
      }
    }
    current.disabled = patch.disabled;
  }

  saveUsersFile(file);
  const { passwordHash: _, ...pub } = current;
  return { ok: true, user: pub };
}

export function deleteUser(
  id: string,
  actorId: string
): { ok: true } | { ok: false; error: string } {
  if (id === actorId) {
    return { ok: false, error: "You cannot delete your own account" };
  }
  const file = loadUsersFile();
  const target = file.users.find((x) => x.id === id);
  if (!target) return { ok: false, error: "User not found" };
  if (target.role === "admin" && !target.disabled) {
    const otherAdmins = file.users.filter((x) => x.role === "admin" && !x.disabled && x.id !== id);
    if (otherAdmins.length === 0) {
      return { ok: false, error: "Cannot delete the only active admin" };
    }
  }
  file.users = file.users.filter((x) => x.id !== id);
  saveUsersFile(file);
  return { ok: true };
}
