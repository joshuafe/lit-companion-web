import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import type { Paper } from "../lib/types";

export default function FeedPage() {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [pinnedIDs, setPinnedIDs] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
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
      .filter((p) => p.title)
      .sort((a, b) => {
        const aFresh = a.published_at && Date.parse(a.published_at) >= freshCutoff ? 1 : 0;
        const bFresh = b.published_at && Date.parse(b.published_at) >= freshCutoff ? 1 : 0;
        if (aFresh !== bFresh) return bFresh - aFresh;
        return (b.relevance_score ?? 0) - (a.relevance_score ?? 0);
      });
    setPapers(ranked);
    setPinnedIDs(new Set((pins || []).map((p: any) => p.paper_id)));
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="max-w-lg mx-auto px-5 pt-10">
      <header className="mb-6">
        <h1 className="text-[34px] font-semibold text-text-primary">Today</h1>
        <p className="text-caption text-text-secondary mt-1">
          {loading
            ? "Loading your feed…"
            : `${papers.length} papers · ranked by your seed`}
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
        {papers.map((p) => (
          <li key={p.id}>
            <Link
              to={`/paper/${p.id}`}
              className="block bg-bg-card rounded-card p-4 active:opacity-80 transition"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="text-eyebrow font-semibold text-text-secondary uppercase tracking-wider line-clamp-1">
                  {p.journal || "Unknown journal"}
                </span>
                <RelevancePill score={p.relevance_score} />
              </div>
              <h2 className="mt-2 text-[17px] font-semibold leading-snug text-text-primary line-clamp-3">
                {p.title}
              </h2>
              {p.summary?.tldr ? (
                <p className="mt-2 text-caption text-text-primary line-clamp-3">
                  {p.summary.tldr}
                </p>
              ) : p.abstract ? (
                <p className="mt-2 text-caption text-text-secondary line-clamp-2">
                  {p.abstract}
                </p>
              ) : null}
              <div className="mt-3 flex items-center justify-between text-caption text-text-secondary">
                <span>
                  {p.authors?.[0] ?? ""}
                  {p.authors && p.authors.length > 1 ? " et al." : ""}
                </span>
                {pinnedIDs.has(p.id) && (
                  <span className="text-accent font-medium">● pinned</span>
                )}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RelevancePill({ score }: { score: number | null }) {
  if (score == null) return null;
  const value = Math.round(score * 100);
  const color =
    value >= 80
      ? "bg-relevance-high"
      : value >= 60
      ? "bg-relevance-mid"
      : "bg-relevance-low";
  return (
    <span
      className={`text-white text-[11px] font-semibold px-2 py-0.5 rounded-full ${color}`}
    >
      {value}
    </span>
  );
}
