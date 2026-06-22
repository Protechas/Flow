import {
  downloadFeedbackAttachmentBuffer,
  getFeedbackSubmissionById,
} from "@/lib/innovation-hub/feedback";
import { hasPermission } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/session";
import { inlineFileContentDisposition } from "@/lib/files/content-disposition";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user?.is_active) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasPermission(user.role, "innovation_hub:manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const submission = await getFeedbackSubmissionById(id);
  if (!submission?.screenshot_storage_path && !submission?.screenshot_data_base64) {
    return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
  }

  try {
    const buffer = await downloadFeedbackAttachmentBuffer(submission);
    const fileName = submission.screenshot_file_name ?? "attachment";
    const mimeType = submission.screenshot_mime_type ?? "application/octet-stream";

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": inlineFileContentDisposition(fileName),
        "Content-Length": String(buffer.length),
      },
    });
  } catch {
    return NextResponse.json({ error: "Download failed" }, { status: 500 });
  }
}
