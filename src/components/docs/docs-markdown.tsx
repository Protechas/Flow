"use client";

import Link from "next/link";
import { useMemo, type ComponentProps } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { DOC_CATALOG, getDocBySlug } from "@/lib/docs/catalog";
import { cn } from "@/lib/utils";

function resolveDocHref(href: string | undefined): string | undefined {
  if (!href) return href;
  if (href.startsWith("http://") || href.startsWith("https://") || href.startsWith("#")) {
    return href;
  }

  const cleaned = href.replace(/^\.\//, "");
  const mdMatch = cleaned.match(/^([A-Za-z0-9_-]+\.md)(#.*)?$/i);
  if (mdMatch) {
    const file = mdMatch[1];
    const hash = mdMatch[2] ?? "";
    const entry = DOC_CATALOG.find((d) => d.file.toLowerCase() === file.toLowerCase());
    if (entry) return `/docs/${entry.slug}${hash}`;
  }

  const slugMatch = cleaned.match(/^\/docs\/([a-z0-9-]+)/i);
  if (slugMatch) return cleaned;

  return href;
}

export function DocsMarkdown({ markdown, className }: { markdown: string; className?: string }) {
  const components = useMemo(
    () => ({
      a: ({ href, children, ...props }: ComponentProps<"a">) => {
        const resolved = resolveDocHref(href);
        if (resolved?.startsWith("/")) {
          return (
            <Link href={resolved} className="text-primary underline-offset-4 hover:underline">
              {children}
            </Link>
          );
        }
        return (
          <a
            href={resolved}
            target={resolved?.startsWith("http") ? "_blank" : undefined}
            rel={resolved?.startsWith("http") ? "noopener noreferrer" : undefined}
            className="text-primary underline-offset-4 hover:underline"
            {...props}
          >
            {children}
          </a>
        );
      },
      h1: ({ children, ...props }: ComponentProps<"h1">) => (
        <h1 className="text-2xl font-semibold tracking-tight mt-8 mb-4 first:mt-0" {...props}>
          {children}
        </h1>
      ),
      h2: ({ children, ...props }: ComponentProps<"h2">) => (
        <h2
          className="text-lg font-semibold tracking-tight mt-8 mb-3 pb-2 border-b border-border/60"
          {...props}
        >
          {children}
        </h2>
      ),
      h3: ({ children, ...props }: ComponentProps<"h3">) => (
        <h3 className="text-base font-semibold mt-6 mb-2" {...props}>
          {children}
        </h3>
      ),
      p: ({ children, ...props }: ComponentProps<"p">) => (
        <p className="text-sm leading-relaxed text-foreground/90 mb-4" {...props}>
          {children}
        </p>
      ),
      ul: ({ children, ...props }: ComponentProps<"ul">) => (
        <ul className="list-disc pl-5 mb-4 space-y-1 text-sm text-foreground/90" {...props}>
          {children}
        </ul>
      ),
      ol: ({ children, ...props }: ComponentProps<"ol">) => (
        <ol className="list-decimal pl-5 mb-4 space-y-1 text-sm text-foreground/90" {...props}>
          {children}
        </ol>
      ),
      li: ({ children, ...props }: ComponentProps<"li">) => (
        <li className="leading-relaxed" {...props}>
          {children}
        </li>
      ),
      table: ({ children, ...props }: ComponentProps<"table">) => (
        <div className="overflow-x-auto mb-6 rounded-md border border-border/60">
          <table className="w-full text-sm" {...props}>
            {children}
          </table>
        </div>
      ),
      thead: ({ children, ...props }: ComponentProps<"thead">) => (
        <thead className="bg-muted/50" {...props}>
          {children}
        </thead>
      ),
      th: ({ children, ...props }: ComponentProps<"th">) => (
        <th className="px-3 py-2 text-left font-medium border-b border-border/60" {...props}>
          {children}
        </th>
      ),
      td: ({ children, ...props }: ComponentProps<"td">) => (
        <td className="px-3 py-2 border-b border-border/40 align-top" {...props}>
          {children}
        </td>
      ),
      code: ({ children, className: codeClassName, ...props }: ComponentProps<"code">) => {
        const isBlock = codeClassName?.includes("language-");
        if (isBlock) {
          return (
            <code
              className={cn(
                "block overflow-x-auto rounded-md bg-muted/60 p-4 text-xs font-mono mb-4",
                codeClassName
              )}
              {...props}
            >
              {children}
            </code>
          );
        }
        return (
          <code
            className="rounded bg-muted/60 px-1.5 py-0.5 text-xs font-mono text-foreground"
            {...props}
          >
            {children}
          </code>
        );
      },
      pre: ({ children, ...props }: ComponentProps<"pre">) => (
        <pre className="mb-4 overflow-x-auto" {...props}>
          {children}
        </pre>
      ),
      blockquote: ({ children, ...props }: ComponentProps<"blockquote">) => (
        <blockquote
          className="border-l-2 border-primary/40 pl-4 italic text-muted-foreground mb-4 text-sm"
          {...props}
        >
          {children}
        </blockquote>
      ),
      hr: (props: ComponentProps<"hr">) => (
        <hr className="my-8 border-border/60" {...props} />
      ),
    }),
    []
  );

  return (
    <article className={cn("docs-prose max-w-none", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {markdown}
      </ReactMarkdown>
    </article>
  );
}

export function DocsSidebarNav({
  activeSlug,
  className,
}: {
  activeSlug?: string;
  className?: string;
}) {
  return (
    <nav className={cn("space-y-1", className)}>
      <Link
        href="/docs"
        className={cn(
          "block rounded-md px-3 py-2 text-sm transition-colors",
          !activeSlug
            ? "bg-primary/10 text-primary font-medium"
            : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
        )}
      >
        All documentation
      </Link>
      {DOC_CATALOG.filter((d) => d.slug !== "readme").map((doc) => (
        <Link
          key={doc.slug}
          href={`/docs/${doc.slug}`}
          className={cn(
            "block rounded-md px-3 py-2 text-sm transition-colors",
            activeSlug === doc.slug
              ? "bg-primary/10 text-primary font-medium"
              : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
          )}
        >
          {doc.title}
        </Link>
      ))}
    </nav>
  );
}

export function getDocTitleFromSlug(slug: string): string {
  return getDocBySlug(slug)?.title ?? "Documentation";
}
