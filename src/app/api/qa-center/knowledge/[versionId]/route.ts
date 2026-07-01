import { getKnowledgeVersionBuffer } from "@/lib/qa-center/knowledge/files";
import { ensureReferenceDocumentsLoaded, getKnowledgeVersionById } from "@/lib/qa-center/knowledge/store";
import { attachmentFileContentDisposition } from "@/lib/files/content-disposition";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  context: { params: Promise<{ versionId: string }> }
) {
  const user = await getCurrentUser();
  if (!user?.is_active || !hasPermission(user.role, "validation:view")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await ensureReferenceDocumentsLoaded();
  const { versionId } = await context.params;
  const version = await getKnowledgeVersionById(versionId);
  if (!version?.storage_path || !version.file_name) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  try {
    const buffer = await getKnowledgeVersionBuffer(versionId);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": version.mime_type || "application/octet-stream",
        "Content-Disposition": attachmentFileContentDisposition(version.file_name),
        "Content-Length": String(buffer.length),
      },
    });
  } catch {
    return NextResponse.json({ error: "Download failed" }, { status: 404 });
  }
}
