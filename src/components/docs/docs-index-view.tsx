import Link from "next/link";
import { DocsSidebarNav } from "@/components/docs/docs-markdown";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DOC_CATALOG,
  DOC_CATEGORY_LABELS,
  getDocsByCategory,
  getRecommendedDocs,
  type DocCategory,
} from "@/lib/docs/catalog";
import { getEffectivePermissionRole } from "@/lib/auth/access-level";
import { normalizeRole } from "@/lib/auth/permissions";
import type { User } from "@/types/flow";
import { BookOpen, ChevronRight } from "lucide-react";

const CATEGORY_ORDER: DocCategory[] = [
  "getting-started",
  "role-guides",
  "reference",
];

export function DocsIndexView({ user }: { user: User }) {
  const role = normalizeRole(getEffectivePermissionRole(user));
  const recommended = getRecommendedDocs(role);

  return (
    <div className="w-full max-w-6xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <BookOpen className="h-5 w-5 text-primary" />
          <span className="flow-hero-eyebrow text-[10px]">Help & Documentation</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Flow Operations Manual</h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
          In-app documentation derived from the live Flow codebase — modules, workflows, permissions,
          and troubleshooting for every role.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <div className="sticky top-16 rounded-lg border border-border/60 bg-card/50 p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 px-3">
              Browse
            </p>
            <DocsSidebarNav />
          </div>
        </aside>

        <div className="space-y-8 min-w-0">
          <section>
            <h2 className="text-sm font-semibold mb-3">Recommended for you</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {recommended.map((doc) => (
                <Link key={doc.slug} href={`/docs/${doc.slug}`}>
                  <Card className="h-full border-border/60 hover:border-primary/30 transition-colors">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center justify-between gap-2">
                        {doc.title}
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xs text-muted-foreground leading-relaxed">{doc.description}</p>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </section>

          {CATEGORY_ORDER.map((category) => {
            const docs = getDocsByCategory(category);
            if (!docs.length) return null;
            return (
              <section key={category}>
                <div className="flex items-center gap-2 mb-3">
                  <h2 className="text-sm font-semibold">{DOC_CATEGORY_LABELS[category]}</h2>
                  <Badge variant="secondary" className="text-[10px]">
                    {docs.length}
                  </Badge>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {docs.map((doc) => (
                    <Link key={doc.slug} href={`/docs/${doc.slug}`}>
                      <Card className="h-full border-border/60 hover:border-primary/30 transition-colors">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm flex items-center justify-between gap-2">
                            {doc.title}
                            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            {doc.description}
                          </p>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              </section>
            );
          })}

          <section>
            <h2 className="text-sm font-semibold mb-3">Full index</h2>
            <Card className="border-border/60">
              <CardContent className="pt-4">
                <ul className="space-y-2">
                  {DOC_CATALOG.map((doc) => (
                    <li key={doc.slug}>
                      <Link
                        href={`/docs/${doc.slug}`}
                        className="text-sm text-primary hover:underline flex items-center gap-2"
                      >
                        {doc.title}
                        <span className="text-xs text-muted-foreground font-normal">
                          — {doc.description}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </section>
        </div>
      </div>
    </div>
  );
}
