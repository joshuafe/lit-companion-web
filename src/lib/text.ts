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
