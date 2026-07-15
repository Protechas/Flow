import Link from "next/link";
import {
  FlowPageShell,
  WorkspaceContainer,
} from "@/components/platform";
import { requirePageAccess } from "@/lib/auth/guard";
import { TOOLS } from "@/lib/tools/registry";
import { ArrowRight, Calculator, FileSearch, ShieldCheck, Wrench } from "lucide-react";

const ICONS = { FileSearch, Calculator, Wrench, ShieldCheck } as const;

export default async function ToolsHubPage() {
  await requirePageAccess("/tools");

  return (
    <FlowPageShell
      title="Tools"
      eyebrow="Utilities"
      breadcrumbs={[{ label: "Tools" }]}
      description="Small utilities for everyday production questions. New tools land here as they're built — request one through the Innovation Hub."
      workspace={
        <WorkspaceContainer elevated={false} bodyClassName="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {TOOLS.map((tool) => {
              const Icon = ICONS[tool.icon];
              return (
                <Link
                  key={tool.id}
                  href={tool.href}
                  prefetch={false}
                  className="group enterprise-panel flex flex-col gap-3 p-5 transition-colors hover:border-primary/50"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-md border border-primary/30 bg-primary/10">
                      <Icon className="h-4.5 w-4.5 text-primary" />
                    </span>
                    <h2 className="font-semibold">{tool.name}</h2>
                  </div>
                  <p className="flex-1 text-sm text-muted-foreground">{tool.description}</p>
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                    Open tool
                    <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </Link>
              );
            })}
          </div>
        </WorkspaceContainer>
      }
    />
  );
}
