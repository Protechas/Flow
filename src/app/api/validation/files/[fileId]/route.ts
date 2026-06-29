import { getValidationFileById, getValidationFileBuffer } from "@/lib/validation-center/runs";
import { attachmentFileContentDisposition } from "@/lib/files/content-disposition";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  context: { params: Promise<{ fileId: string }> }
) {
  const user = await getCurrentUser();
  if (!user?.is_active || !hasPermission(user.role, "validation:view")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { fileId } = await context.params;
  const file = await getValidationFileById(fileId);
  if (!file) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  try {
    const buffer = await getValidationFileBuffer(file);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": file.mime_type || "application/octet-stream",
        "Content-Disposition": attachmentFileContentDisposition(file.file_name),
        "Content-Length": String(buffer.length),
      },
    });
  } catch {
    return NextResponse.json({ error: "Download failed" }, { status: 500 });
  }
}
