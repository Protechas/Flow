import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { FileStack } from "lucide-react";

export default function FilesPage() {
  return (
    <>
      <PageHeader
        title="Files"
        description="Work item and project attachments"
      />
      <Card className="border-border/60 border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <FileStack className="h-12 w-12 mb-4 opacity-40" />
          <p className="text-sm">File uploads connect to Supabase Storage when configured.</p>
          <p className="text-xs mt-2">Attach files from Work Tracker items.</p>
        </CardContent>
      </Card>
    </>
  );
}
