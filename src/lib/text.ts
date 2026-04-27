// Shared text helpers. PubMed and publisher RSS often deliver titles
// and abstracts with HTML tags ( <sup>, <sub>, <i>, <b>, <em>, <br> )
// that would otherwise render as literal text in React. One central
// stripper means a fix here applies everywhere.

const _TAG_RE = /<[^>]+>/g;
const _WS_RE = /\s+/g;
const _ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&apos;": "'",
  "&#39;": "'",
  "&nbsp;": " ",
};

/**
 * Strip HTML tags and decode common entities. Preserves the inner text
 * — so "10<sup>3</sup>" becomes "103" (correct: it's the spelled
 * number, not a typographic transformation we should attempt).
 */
export function stripHtml(s: string | null | undefined): string {
  if (!s) return "";
  let out = s.replace(_TAG_RE, "");
  for (const [entity, ch] of Object.entries(_ENTITIES)) {
    out = out.split(entity).join(ch);
  }
  out = out.replace(/&#(\d+);/g, (_m, n) =>
    String.fromCharCode(parseInt(n, 10)),
  );
  return out.replace(_WS_RE, " ").trim();
}

// PubMed and publisher RSS prefix some titles with a bracketed type
// label: "[Clinical image] ...", "[Case report] ...", "[Letter] ...".
// Surface them as typed chips and strip them from the displayed title.
//
// Items in this map are KEPT in the feed (they're real content); we
// just signal what kind of thing they are. NON_RESEARCH_PREFIXES in
// content_filter.py removes editorial/news entirely — different intent.
const _BRACKET_TYPES: Record<string, string> = {
  "clinical image": "Clinical image",
  "case report": "Case report",
  "image": "Image",
  "case": "Case report",
  "perspective": "Perspective",
  "perspectives": "Perspective",
  "viewpoint": "Viewpoint",
  "review": "Review",
  "research letter": "Research letter",
};

export interface TitleType {
  display: string;
  typeChip: string | null;
}

/**
 * Extract a bracketed type prefix from a title. Returns the cleaned
 * title plus the chip label (e.g. "Clinical image") if recognized.
 * Unrecognized brackets are left in place — never silently lose info.
 */
export function parseTitleType(title: string | null | undefined): TitleType {
  const t = (title || "").trim();
  if (!t.startsWith("[")) return { display: t, typeChip: null };
  const m = t.match(/^\[([^\]]+)\]\s*[:.\-—]?\s*(.+)$/);
  if (!m) return { display: t, typeChip: null };
  const inside = m[1].trim().toLowerCase();
  const rest = m[2].trim();
  const chip = _BRACKET_TYPES[inside];
  if (!chip) return { display: t, typeChip: null };
  return { display: rest, typeChip: chip };
}
