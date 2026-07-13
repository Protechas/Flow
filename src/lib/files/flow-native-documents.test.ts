import { describe, expect, it } from "vitest";
import {
  createFlowNativeDocument,
  getCompanyDocumentContent,
  listCompanyDocuments,
} from "@/lib/files/company-documents";
import { isDocumentEditable } from "@/lib/files/document-editing";
import { documentHtmlToText } from "@/lib/ai/sop-review";

describe("Flow-native documents (authored in Flow, no upload)", () => {
  it("creates a doc with an HTML snapshot file and live content", async () => {
    const doc = await createFlowNativeDocument({
      title: "SOP — Test & <Escaping>",
      category: "sop",
      folder_id: null,
      tags: ["qa", "imports"],
      created_by: "user-admin",
    });

    expect(doc.file_name.endsWith(".html")).toBe(true);
    expect(doc.mime_type).toBe("text/html");
    expect(doc.title).toBe("SOP — Test & <Escaping>");
    expect(doc.tags).toEqual(["qa", "imports"]);

    // Live content saved at creation, with the title escaped
    const content = await getCompanyDocumentContent(doc.id);
    expect(content).toContain("<h1>SOP — Test &amp; &lt;Escaping></h1>");

    // Editable in Flow and listed
    expect(isDocumentEditable(doc)).toBe(true);
    const listed = await listCompanyDocuments();
    expect(listed.some((d) => d.id === doc.id)).toBe(true);
  });
});

describe("documentHtmlToText (Eddy review input)", () => {
  it("flattens headings, lists, and entities to reviewable text", () => {
    const html =
      "<h1>Title</h1><p>Step 1 &amp; done</p><ul><li>First</li><li>Second</li></ul><p>End&nbsp;here</p>";
    const text = documentHtmlToText(html);
    expect(text).toContain("[h1] Title");
    expect(text).toContain("Step 1 & done");
    expect(text).toContain("- First");
    expect(text).toContain("- Second");
    expect(text).toContain("End here");
    expect(text).not.toContain("<");
  });
});
