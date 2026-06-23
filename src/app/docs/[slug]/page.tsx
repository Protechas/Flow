import { notFound } from "next/navigation";
import { DocsArticleView } from "@/components/docs/docs-article-view";
import { requirePageAccess } from "@/lib/auth/guard";
import { loadDocBySlug } from "@/lib/docs/load-doc";

export default async function DocsArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  await requirePageAccess("/docs");
  const { slug } = await params;
  const doc = await loadDocBySlug(slug);
  if (!doc) notFound();

  return <DocsArticleView entry={doc.entry} markdown={doc.markdown} />;
}
