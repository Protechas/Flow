import { assertCanViewTaskFile, getCurrentUser } from "@/lib/auth/session";
import { getTaskFileById, initProductionTracking } from "@/lib/data/production-tracking";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  context: { params: Promise<{ fileId: string }> }
) {
  const user = await getCurrentUser();
  if (!user?.is_active) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { fileId } = await context.params;
  initProductionTracking();
  const file = getTaskFileById(fileId);
  if (!file) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  try {
    await assertCanViewTaskFile(user, file.task_id);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!file.file_data_base64) {
    return NextResponse.json(
      { error: "File content is not available for this upload" },
      { status: 404 }
    );
  }

  const buffer = Buffer.from(file.file_data_base64, "base64");
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": file.file_type || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${file.file_name.replace(/"/g, "")}"`,
      "Content-Length": String(buffer.length),
    },
  });
}
