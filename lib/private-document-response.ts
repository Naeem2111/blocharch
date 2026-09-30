import { NextResponse } from "next/server";
import { downloadDriveFile } from "@/lib/google-drive";

export function documentStreamResponse(
  filename: string,
  mimeType: string,
  body: ReadableStream<Uint8Array>,
  inline: boolean,
) {
  const safe = filename.replace(/["\r\n]/g, "");
  const disposition = inline ? "inline" : "attachment";
  return new NextResponse(body, {
    headers: {
      "Content-Type": mimeType,
      "Content-Disposition": `${disposition}; filename="${safe}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "private, max-age=60",
    },
  });
}

export async function streamDriveDocument(fileId: string, filename: string, mimeType: string | null, inline: boolean) {
  const file = await downloadDriveFile(fileId);
  return documentStreamResponse(filename, mimeType || file.mimeType, file.body, inline);
}
