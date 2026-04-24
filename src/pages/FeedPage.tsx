import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import type { Paper } from "../lib/types";

const JUNK_TITLES = new Set([
  "jama", "nature", "science", "lancet", "cell", "nejm", "bmj", "blood", "immunity",
]);
const NON_RESEARCH_PREFIXES = [
  "[obituary]", "[correspondence]", "[correction]", "[corrigendum]",
  "[erratum]", "[retraction]", "[editorial]", "[comment]", "[news]",
  "[world report]", "[perspective]", "[perspectives]", "[letter]",
  "snapshot:", "daily briefing", "retraction:", "author correction:",
  "publisher correction:",
];

function isJunk(title: string | null | undefined): boolean {
  if (!title) return true;
  const t = title.trim().toLowerCase();
  if (!t || JUNK_TITLES.has(t)) return true;
  return NON_RESEARCH_PREFIXES.some((p) => t.startsWith(p));
}

function stripHtml(s: string | null | undefined): string {
  if (!s) return "";
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso.length === 10 ? iso + "T00:00:00" : iso);
  const now = Date.now();
  const days = Math.floor((now - d.getTime()) / 86_400_000);
  if (days < 2) return "today";
  if (days < 14) return `${days}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// Derive compact feature chips from paper metadata.
function featureChips(p: Paper): { label: string; tone: "warm" | "cool" | "accent" }[] {
  const chips: { label: string; tone: "warm" | "cool" | "accent" }[] = [];
  const title = (p.title || "").toLowerCase();
  const doi = (p.doi || "").toLowerCase();

  if (doi.includes("biorxiv") || doi.includes("medrxiv") ||
      p.journal?.toLowerCase().includes("biorxiv") ||
      p.journal?.toLowerCase().includes("medrxiv") ||
      p.journal?.toLowerCase().includes("preprint")) {
    chips.push({ label: "preprint", tone: "cool" });
  }
  if (/\bphase\s+([0-3i]+)\b/.test(title) || title.includes("first-in-human")) {
    chips.push({ label: "trial", tone: "accent" });
  }
  if (title.includes("randomized") || title.includes("randomised")) {
    chips.push({ label: "RCT", tone: "accent" });
  }
  if (title.startsWith("review") || title.includes(" review ") ||
      title.includes("systematic review") || title.includes("meta-analysis")) {
    chips.push({ label: "review", tone: "cool" });
  }
  if (p.published_at) {
    const days = Math.floor((Date.now() - new Date(p.published_at).getTime()) / 86_400_000);
    if (days <= 2) chips.push({ label: "new", tone: "warm" });
  }
  return chips;
}

export default function FeedPage() {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [pinnedIDs, setPinnedIDs] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
      .toISOString().slice(0, 10);
    const [{ data: rows, error: err1 }, { data: pins }] = await Promise.all([
      supabase
        .from("papers")
        .select()
        .or(`published_at.gte.${ninetyDaysAgo},published_at.is.null`)
        .order("relevance_score", { ascending: false })
        .limit(60),
      supabase.from("pins").select("paper_id"),
    ]);
    if (err1) setError(err1.message);

    const freshCutoff = Date.now() - 2 * 24 * 60 * 60 * 1000;
    const ranked = ((rows as Paper[]) || [])
      .filter((p) => !isJunk(p.title))
      .sort((a, b) => {
        const aFresh = a.published_at && Date.parse(a.published_at) >= freshCutoff ? 1 : 0;
        const bFresh = b.published_at && Date.parse(b.published_at) >= freshCutoff ? 1 : 0;
        if (aFresh !== bFresh) return bFresh - aFresh;
        return (b.relevance_score ?? 0) - (a.relevance_score ?? 0);
      })
      .slice(0, 20);

    setPapers(ranked);
    setPinnedIDs(new Set((pins || []).map((p: any) => p.paper_id)));
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  // Percentile rank of each paper within the CURRENT feed, so the pill
  // color reflects relative strength (not raw cosine — which compresses
  // into the high 90s for related-topic corpora).
  const rankByIndex = useMemo(() => {
    const scored = papers
      .map((p, i) => ({ i, s: p.relevance_score ?? 0 }))
      .sort((a, b) => b.s - a.s);
    const rank = new Array(papers.length).fill(0);
    scored.forEach((x, rIdx) => { rank[x.i] = rIdx; });
    return rank;
  }, [papers]);

  return (
    <div className="max-w-lg mx-auto px-5 pt-10">
      <header className="mb-6">
        <h1 className="text-[34px] font-semibold text-text-primary">Today</h1>
        <p className="text-caption text-text-secondary mt-1">
          {loading
            ? "Loading your feed…"
            : `${papers.length} papers · latest first, then relevance`}
        </p>
      </header>

      {error && <div className="text-sm text-red-600 mb-4">{error}</div>}

      {!loading && papers.length === 0 && (
        <div className="text-center py-16">
          <div className="text-4xl mb-3">📂</div>
          <p className="text-text-primary font-medium mb-1">Your feed is quiet</p>
          <p className="text-caption text-text-secondary">
            The pipeline will populate it on the next nightly run.
          </p>
        </div>
      )}

      <ul className="space-y-3">
        {papers.map((p, i) => {
          const chips = featureChips(p);
          const inst = p.last_author_institution || p.first_author_institution;
          return (
            <li key={p.id}>
              <Link
                to={`/paper/${p.id}`}
                className="block bg-bg-card rounded-card p-4 active:opacity-80 transition"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="text-eyebrow font-semibold text-text-secondary uppercase tracking-wider line-clamp-1">
                    {p.journal || "Unknown journal"}
                    {p.published_at && (
                      <span className="ml-2 normal-case tracking-normal text-text-secondary/70">
                        · {fmtDate(p.published_at)}
                      </span>
                    )}
                  </span>
                  <RelevancePill rank={rankByIndex[i]} total={papers.length} />
                </div>

                <h2 className="mt-2 text-[17px] font-semibold leading-snug text-text-primary line-clamp-3">
                  {stripHtml(p.title)}
                </h2>

                {p.summary?.tldr && (
                  <p className="mt-2 text-caption text-text-primary line-clamp-3">
                    {stripHtml(p.summary.tldr)}
                  </p>
                )}

                {chips.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {chips.map((c) => (
                      <span
                        key={c.label}
                        className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                          c.tone === "warm"
                            ? "bg-accent/15 text-accent"
                            : c.tone === "accent"
                            ? "bg-accent text-white"
                            : "bg-bg-primary text-text-secondary"
                        }`}
                      >
                        {c.label}
                      </span>
                    ))}
                  </div>
                )}

                <div className="mt-3 flex items-center justify-between text-caption text-text-secondary gap-2">
                  <span className="truncate">
                    {p.authors?.[p.authors.length - 1] ?? p.authors?.[0] ?? ""}
                    {inst && <span className="text-text-secondary/80"> · {inst}</span>}
                  </span>
                  {pinnedIDs.has(p.id) && (
                    <span className="text-accent font-medium shrink-0">● pinned</span>
                  )}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function RelevancePill({ rank, total }: { rank: number; total: number }) {
  if (total === 0) return null;
  const pct = (rank / total);
  const color =
    pct < 0.25 ? "bg-relevance-high" :
    pct < 0.6  ? "bg-relevance-mid"  :
    "bg-relevance-low";
  return (
    <span className={`text-white text-[11px] font-semibold px-2 py-0.5 rounded-full ${color}`}>
      #{rank + 1}
    </span>
  );
}
