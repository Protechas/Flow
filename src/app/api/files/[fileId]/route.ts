import { assertCanViewTaskFile, getCurrentUser } from "@/lib/auth/session";
import { inlineFileContentDisposition, attachmentFileContentDisposition } from "@/lib/files/content-disposition";
import { getTaskFileById, initProductionTracking } from "@/lib/data/production-tracking";
import { ensureAppDataLoaded } from "@/lib/data/app-hydrate";
import { downloadTaskFileBuffer } from "@/lib/files/task-files";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  context: { params: Promise<{ fileId: string }> }
) {
  const user = await getCurrentUser();
  if (!user?.is_active) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { fileId } = await context.params;
  initProductionTracking();
  // Route handlers skip layout hydration — without the FULL app hydration,
  // cold instances 404 every download (empty production store) and 403
  // employees (the ownership check can't find the work package).
  await ensureAppDataLoaded();
  const file = getTaskFileById(fileId);
  if (!file) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  try {
    await assertCanViewTaskFile(user, file.task_id);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const buffer = await downloadTaskFileBuffer(file);
  if (!buffer) {
    return NextResponse.json(
      { error: "File content is not available for this upload" },
      { status: 404 }
    );
  }
  const forceDownload = new URL(request.url).searchParams.get("download") === "1";
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": file.file_type || "application/octet-stream",
      "Content-Disposition": forceDownload
        ? attachmentFileContentDisposition(file.file_name)
        : inlineFileContentDisposition(file.file_name),
      "Content-Length": String(buffer.length),
    },
  });
}
