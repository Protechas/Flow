import { DOC_CATALOG, type DocEntry } from "@/lib/docs/catalog";
import { loadDocMarkdown } from "@/lib/docs/load-doc";

export interface DocSection {
  docTitle: string;
  docSlug: string;
  heading: string;
  content: string;
  score: number;
}

const STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "to", "in", "on", "of", "for", "is", "are",
  "how", "do", "i", "my", "can", "what", "where", "when", "why", "does", "it",
  "with", "at", "be", "this", "that", "me", "you", "we", "our",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9-]+/)
    .filter((t) => t.length > 2 && !STOP_WORDS.has(t));
}

function splitSections(entry: DocEntry, markdown: string): Omit<DocSection, "score">[] {
  const sections: Omit<DocSection, "score">[] = [];
  const parts = markdown.split(/^(?=#{1,3} )/m);
  for (const part of parts) {
    const lines = part.split("\n");
    const heading = lines[0]?.replace(/^#+\s*/, "").trim() || entry.title;
    const content = part.trim();
    if (content.length < 60) continue;
    sections.push({
      docTitle: entry.title,
      docSlug: entry.slug,
      heading,
      content: content.slice(0, 2400),
    });
  }
  return sections;
}

let sectionCache: Omit<DocSection, "score">[] | null = null;

async function allSections(): Promise<Omit<DocSection, "score">[]> {
  if (sectionCache) return sectionCache;
  const sections: Omit<DocSection, "score">[] = [];
  for (const entry of DOC_CATALOG) {
    try {
      const md = await loadDocMarkdown(entry);
      sections.push(...splitSections(entry, md));
    } catch {
      // doc missing — skip
    }
  }
  sectionCache = sections;
  return sections;
}

/** Keyword-scored retrieval over the operations docs. */
export async function searchDocs(query: string, limit = 4): Promise<DocSection[]> {
  const terms = tokenize(query);
  if (terms.length === 0) return [];
  const sections = await allSections();

  const scored = sections.map((s) => {
    const headingLower = s.heading.toLowerCase();
    const contentLower = s.content.toLowerCase();
    let score = 0;
    for (const term of terms) {
      if (headingLower.includes(term)) score += 5;
      // count occurrences in the body, capped so one word can't dominate
      let idx = 0;
      let hits = 0;
      while (hits < 6 && (idx = contentLower.indexOf(term, idx)) !== -1) {
        hits += 1;
        idx += term.length;
      }
      score += hits;
    }
    return { ...s, score };
  });

  return scored
    .filter((s) => s.score >= 3)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
