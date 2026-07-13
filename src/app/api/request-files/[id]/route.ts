import { downloadTicketFileBuffer, getTicketFileById } from "@/lib/requests/ticket-files";
import {
  attachmentFileContentDisposition,
  inlineFileContentDisposition,
} from "@/lib/files/content-disposition";
import { getCurrentUser } from "@/lib/auth/session";
import { NextResponse } from "next/server";

/** Serves a ticket attachment — click to download, or drag it into an email. */
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user?.is_active) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const file = await getTicketFileById(id);
  if (!file) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const forceDownload = new URL(request.url).searchParams.get("download") === "1";

  try {
    const buffer = await downloadTicketFileBuffer(file);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": file.mime_type || "application/octet-stream",
        "Content-Disposition": forceDownload
          ? attachmentFileContentDisposition(file.file_name)
          : inlineFileContentDisposition(file.file_name),
        "Content-Length": String(buffer.length),
      },
    });
  } catch {
    return NextResponse.json({ error: "Download failed" }, { status: 500 });
  }
}
