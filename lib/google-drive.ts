/**
 * Blocharch Google Drive — one folder per private client.
 *
 * Uses the same OAuth client as Calendar. The refresh token must include
 * https://www.googleapis.com/auth/drive (re-run scripts/google-oauth-refresh-token.mjs).
 *
 * Optional: GOOGLE_DRIVE_ROOT_FOLDER_ID — parent folder. Otherwise a
 * "Blocharch Clients" folder is created in that Google account's Drive.
 */

const DRIVE_SCOPE_HINT = "https://www.googleapis.com/auth/drive";
const FOLDER_MIME = "application/vnd.google-apps.folder";
const ROOT_FOLDER_NAME = "Blocharch Clients";

export type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  clientVisible: boolean;
};

type TokenCache = { token: string; expiresAt: number };
let cachedAccessToken: TokenCache | null = null;
let cachedRootFolderId: string | null = null;

export function isGoogleDriveConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID?.trim() &&
      process.env.GOOGLE_CLIENT_SECRET?.trim() &&
      process.env.GOOGLE_REFRESH_TOKEN?.trim(),
  );
}

function oauthConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN?.trim();
  if (!clientId || !clientSecret || !refreshToken) return null;
  return { clientId, clientSecret, refreshToken };
}

async function accessToken(): Promise<string> {
  const config = oauthConfig();
  if (!config) throw new Error("Google Drive is not configured");
  if (cachedAccessToken && cachedAccessToken.expiresAt > Date.now() + 60_000) {
    return cachedAccessToken.token;
  }
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: config.refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const data = (await res.json()) as { access_token?: string; expires_in?: number; error?: string };
  if (!res.ok || !data.access_token) {
    throw new Error(data.error || "Failed to refresh Google access token");
  }
  cachedAccessToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
  };
  return data.access_token;
}

async function driveFetch(url: string, init?: RequestInit): Promise<Response> {
  const token = await accessToken();
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${token}`);
  return fetch(url, { ...init, headers });
}

function escapeQuery(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

async function findChildFolder(parentId: string, name: string): Promise<string | null> {
  const q = [
    `mimeType='${FOLDER_MIME}'`,
    `name='${escapeQuery(name)}'`,
    `'${parentId}' in parents`,
    "trashed=false",
  ].join(" and ");
  const url = new URL("https://www.googleapis.com/drive/v3/files");
  url.searchParams.set("q", q);
  url.searchParams.set("fields", "files(id,name)");
  url.searchParams.set("pageSize", "1");
  url.searchParams.set("supportsAllDrives", "true");
  url.searchParams.set("includeItemsFromAllDrives", "true");
  const res = await driveFetch(url.toString());
  if (!res.ok) throw await driveError(res);
  const data = (await res.json()) as { files?: Array<{ id: string }> };
  return data.files?.[0]?.id ?? null;
}

async function createFolder(name: string, parentId: string | null): Promise<string> {
  const res = await driveFetch("https://www.googleapis.com/drive/v3/files?supportsAllDrives=true&fields=id", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      mimeType: FOLDER_MIME,
      ...(parentId ? { parents: [parentId] } : {}),
    }),
  });
  if (!res.ok) throw await driveError(res);
  const data = (await res.json()) as { id: string };
  return data.id;
}

async function folderExists(folderId: string): Promise<boolean> {
  const res = await driveFetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(folderId)}?fields=id,trashed&supportsAllDrives=true`,
  );
  if (res.status === 404) return false;
  if (!res.ok) throw await driveError(res);
  const data = (await res.json()) as { trashed?: boolean };
  return data.trashed !== true;
}

export async function ensureDriveRootFolder(): Promise<string> {
  const configured = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID?.trim();
  if (configured) return configured;
  if (cachedRootFolderId && (await folderExists(cachedRootFolderId))) return cachedRootFolderId;
  const existing = await findChildFolder("root", ROOT_FOLDER_NAME);
  cachedRootFolderId = existing ?? (await createFolder(ROOT_FOLDER_NAME, null));
  return cachedRootFolderId;
}

export function clientFolderName(clientName: string, slug: string | null) {
  const clean = clientName.replace(/[\\/]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
  return clean || slug || "Client";
}

export async function ensureClientDriveFolder(input: {
  clientName: string;
  slug: string | null;
  existingFolderId: string | null;
}): Promise<string> {
  if (input.existingFolderId && (await folderExists(input.existingFolderId))) {
    return input.existingFolderId;
  }
  const rootId = await ensureDriveRootFolder();
  const name = clientFolderName(input.clientName, input.slug);
  return (await findChildFolder(rootId, name)) ?? (await createFolder(name, rootId));
}

export async function listClientDriveFiles(folderId: string): Promise<DriveFile[]> {
  const files: DriveFile[] = [];
  let pageToken = "";
  do {
    const q = `'${folderId}' in parents and trashed=false and mimeType!='${FOLDER_MIME}'`;
    const url = new URL("https://www.googleapis.com/drive/v3/files");
    url.searchParams.set("q", q);
    url.searchParams.set("fields", "nextPageToken,files(id,name,mimeType,size,appProperties)");
    url.searchParams.set("pageSize", "100");
    url.searchParams.set("supportsAllDrives", "true");
    url.searchParams.set("includeItemsFromAllDrives", "true");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const res = await driveFetch(url.toString());
    if (!res.ok) throw await driveError(res);
    const data = (await res.json()) as {
      nextPageToken?: string;
      files?: Array<{
        id: string;
        name: string;
        mimeType?: string;
        size?: string;
        appProperties?: { clientVisible?: string };
      }>;
    };
    for (const file of data.files ?? []) {
      files.push({
        id: file.id,
        name: file.name,
        mimeType: file.mimeType || "application/octet-stream",
        sizeBytes: Number(file.size || 0) || 0,
        clientVisible: file.appProperties?.clientVisible !== "false",
      });
    }
    pageToken = data.nextPageToken ?? "";
  } while (pageToken);
  return files;
}

export async function createResumableUpload(input: {
  folderId: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  clientVisible: boolean;
  clientId: string;
  projectId: string;
}): Promise<string> {
  const res = await driveFetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true&fields=id",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": input.mimeType || "application/octet-stream",
        "X-Upload-Content-Length": String(input.sizeBytes),
      },
      body: JSON.stringify({
        name: input.name,
        parents: [input.folderId],
        appProperties: {
          blocharchClientId: input.clientId,
          blocharchProjectId: input.projectId,
          clientVisible: input.clientVisible ? "true" : "false",
        },
      }),
    },
  );
  if (!res.ok) throw await driveError(res);
  const uploadUrl = res.headers.get("location");
  if (!uploadUrl) throw new Error("Google Drive did not return an upload URL");
  return uploadUrl;
}

export async function uploadDriveFile(input: {
  folderId: string;
  name: string;
  mimeType: string;
  bytes: Buffer;
  clientVisible: boolean;
  clientId: string;
  projectId: string;
}): Promise<{ id: string; sizeBytes: number }> {
  const boundary = `blocarch_${crypto.randomUUID().replace(/-/g, "")}`;
  const meta = JSON.stringify({
    name: input.name,
    parents: [input.folderId],
    appProperties: {
      blocharchClientId: input.clientId,
      blocharchProjectId: input.projectId,
      clientVisible: input.clientVisible ? "true" : "false",
    },
  });
  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: ${input.mimeType || "application/octet-stream"}\r\n\r\n`,
    ),
    input.bytes,
    Buffer.from(`\r\n--${boundary}--`),
  ]);
  const res = await driveFetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,size",
    {
      method: "POST",
      headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
      body,
    },
  );
  if (!res.ok) throw await driveError(res);
  const data = (await res.json()) as { id: string; size?: string };
  return { id: data.id, sizeBytes: Number(data.size || input.bytes.length) || input.bytes.length };
}

export async function assertFileInFolder(fileId: string, folderId: string): Promise<DriveFile> {
  const res = await driveFetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=id,name,mimeType,size,parents,appProperties,trashed&supportsAllDrives=true`,
  );
  if (!res.ok) throw await driveError(res);
  const data = (await res.json()) as {
    id: string;
    name: string;
    mimeType?: string;
    size?: string;
    parents?: string[];
    trashed?: boolean;
    appProperties?: { clientVisible?: string };
  };
  if (data.trashed || !data.parents?.includes(folderId)) {
    throw new Error("File is not in this client's Drive folder");
  }
  return {
    id: data.id,
    name: data.name,
    mimeType: data.mimeType || "application/octet-stream",
    sizeBytes: Number(data.size || 0) || 0,
    clientVisible: data.appProperties?.clientVisible !== "false",
  };
}

export async function setDriveFileVisibility(fileId: string, clientVisible: boolean): Promise<void> {
  const res = await driveFetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?supportsAllDrives=true`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appProperties: { clientVisible: clientVisible ? "true" : "false" } }),
    },
  );
  if (!res.ok) throw await driveError(res);
}

export async function downloadDriveFile(fileId: string): Promise<{ body: ReadableStream<Uint8Array>; mimeType: string }> {
  const metaRes = await driveFetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=mimeType&supportsAllDrives=true`,
  );
  const meta = metaRes.ok ? ((await metaRes.json()) as { mimeType?: string }) : {};
  const res = await driveFetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`,
  );
  if (!res.ok || !res.body) throw await driveError(res);
  return { body: res.body, mimeType: meta.mimeType || res.headers.get("content-type") || "application/octet-stream" };
}

export async function deleteDriveFile(fileId: string): Promise<void> {
  const res = await driveFetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?supportsAllDrives=true`,
    { method: "DELETE" },
  );
  if (!res.ok && res.status !== 404) throw await driveError(res);
}

async function driveError(res: Response): Promise<Error> {
  const data = (await res.json().catch(() => ({}))) as { error?: { message?: string; status?: string } };
  const message = data.error?.message || `Google Drive request failed (${res.status})`;
  if (/insufficient/i.test(message) || data.error?.status === "PERMISSION_DENIED") {
    return new Error(`Google Drive access was denied. Reconnect with the ${DRIVE_SCOPE_HINT} scope.`);
  }
  return new Error(message);
}
