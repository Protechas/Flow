import { getCompanyDocumentById, downloadCompanyDocumentBuffer } from "@/lib/files/company-documents";
import { inlineFileContentDisposition, attachmentFileContentDisposition } from "@/lib/files/content-disposition";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { getEffectivePermissionRole } from "@/lib/auth/access-level";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user?.is_active) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasPermission(getEffectivePermissionRole(user), "company_documents:view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const doc = await getCompanyDocumentById(id);
  if (!doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  const forceDownload = new URL(request.url).searchParams.get("download") === "1";

  try {
    const buffer = await downloadCompanyDocumentBuffer(doc);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": doc.mime_type || "application/octet-stream",
        "Content-Disposition": forceDownload
          ? attachmentFileContentDisposition(doc.file_name)
          : inlineFileContentDisposition(doc.file_name),
        "Content-Length": String(buffer.length),
      },
    });
  } catch {
    return NextResponse.json({ error: "Download failed" }, { status: 500 });
  }
}
