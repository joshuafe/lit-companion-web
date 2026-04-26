import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import type { Paper } from "../lib/types";

// "Latest" — raw RSS-like view of the user's preferred journals,
// sorted purely by most recently ingested. No relevance ranking, no
// junk filtering beyond obvious title-only items. Shows what's new in
// your top-of-rack journals so you can scan headlines without the
// algorithm in the way.

function fmtTimeAgo(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const ms = Date.now() - d.getTime();
  const min = Math.floor(ms / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  if (days < 14) return `${days}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function stripHtml(s: string | null | undefined): string {
  if (!s) return "";
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function todayLabel(d: Date): string {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  const dCopy = new Date(d);
  dCopy.setHours(0, 0, 0, 0);
  const days = Math.round((t.getTime() - dCopy.getTime()) / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
}

export default function LatestPage() {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [journalFilter, setJournalFilter] = useState<string | null>(null);
  const [preferredJournals, setPreferredJournals] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    // Pull preferred journals first so we can filter to them.
    const { data: profile } = await supabase
      .from("profiles")
      .select("suggested_journals")
      .maybeSingle();
    const raw = (profile?.suggested_journals as { name: string }[] | string[]) || [];
    const journalNames = raw.map((x: any) => typeof x === "string" ? x : x.name).filter(Boolean);
    setPreferredJournals(journalNames);

    // Pull last 30 days of papers from the user's preferred journals,
    // sorted strictly by created_at desc.
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString();
    let q = supabase
      .from("papers")
      .select("*")
      .gte("created_at", thirtyDaysAgo)
      .order("created_at", { ascending: false })
      .limit(200);
    if (journalNames.length > 0) {
      q = q.in("journal", journalNames);
    }
    const { data, error: err } = await q;
    if (err) setError(err.message);
    setPapers((data as Paper[]) || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const filtered = journalFilter
    ? papers.filter((p) => p.journal === journalFilter)
    : papers;

  // Group by ingest day for readable scanning.
  const groups: { day: string; date: Date; papers: Paper[] }[] = [];
  let currentDay: string | null = null;
  for (const p of filtered) {
    if (!p.created_at) continue;
    const d = new Date(p.created_at);
    const dayKey = d.toISOString().slice(0, 10);
    if (dayKey !== currentDay) {
      currentDay = dayKey;
      groups.push({ day: todayLabel(d), date: d, papers: [] });
    }
    groups[groups.length - 1].papers.push(p);
  }

  // Distinct journals seen, for filter chips.
  const journalCounts = new Map<string, number>();
  for (const p of papers) {
    if (!p.journal) continue;
    journalCounts.set(p.journal, (journalCounts.get(p.journal) || 0) + 1);
  }
  const journalChips = Array.from(journalCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12);

  return (
    <div className="max-w-lg mx-auto px-5 pt-10 pb-32">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-[34px] font-semibold text-text-primary leading-tight">
            Latest
          </h1>
          <p className="text-caption text-text-secondary mt-1">
            Newest papers from your top journals — reverse-chronological, no ranking.
          </p>
        </div>
        <Link
          to="/toc"
          className="shrink-0 mt-2 px-3 py-1.5 rounded-full bg-bg-card border border-jewel-emerald/30 text-jewel-emerald text-[11px] font-semibold uppercase tracking-wider"
          title="Live TOC pulled from each journal's RSS feed"
        >
          Live TOC →
        </Link>
      </div>

      {preferredJournals.length === 0 && (
        <div className="mt-6 bg-bg-card rounded-2xl p-4 text-caption text-text-secondary">
          No preferred journals yet.{" "}
          <Link to="/settings/journals" className="text-jewel-emerald font-medium">
            Pick a starting set →
          </Link>
        </div>
      )}

      {journalChips.length > 0 && (
        <div className="mt-4 flex gap-1.5 flex-wrap">
          <button
            onClick={() => setJournalFilter(null)}
            className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${
              !journalFilter
                ? "bg-jewel-emerald text-white"
                : "bg-bg-card text-text-secondary border border-stroke"
            }`}
          >
            All ({papers.length})
          </button>
          {journalChips.map(([j, n]) => (
            <button
              key={j}
              onClick={() => setJournalFilter(journalFilter === j ? null : j)}
              className={`text-[11px] font-semibold px-2.5 py-1 rounded-full transition ${
                journalFilter === j
                  ? "bg-jewel-emerald text-white"
                  : "bg-bg-card text-text-secondary border border-stroke hover:border-jewel-emerald"
              }`}
            >
              {j} <span className="opacity-70 font-normal">{n}</span>
            </button>
          ))}
        </div>
      )}

      {error && <div className="mt-4 text-sm text-red-600">{error}</div>}

      {loading && (
        <div className="mt-8 text-center text-caption text-text-secondary">Loading…</div>
      )}

      {!loading && filtered.length === 0 && preferredJournals.length > 0 && (
        <div className="mt-10 text-center py-10">
          <div className="text-4xl mb-3">🌑</div>
          <p className="text-text-primary font-medium">Nothing in the last 30 days</p>
          <p className="text-caption text-text-secondary mt-1 max-w-xs mx-auto">
            The pipeline hasn't ingested any papers from your preferred
            journals lately. Try adding a broader bundle in Settings.
          </p>
        </div>
      )}

      <div className="mt-6 space-y-6">
        {groups.map(({ day, papers: dayPapers }) => (
          <section key={day}>
            <div className="text-eyebrow font-semibold text-text-secondary uppercase tracking-wider mb-2">
              {day} <span className="text-text-secondary/60 font-normal">· {dayPapers.length}</span>
            </div>
            <ul className="space-y-2">
              {dayPapers.map((p) => (
                <li key={p.id}>
                  <Link
                    to={`/paper/${p.id}`}
                    className="block bg-bg-card rounded-card p-3 active:opacity-80"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-eyebrow font-semibold text-text-secondary uppercase tracking-wider line-clamp-1">
                        {p.journal || "Unknown"}
                      </span>
                      <span className="text-[10px] font-mono text-text-secondary/70 shrink-0">
                        {fmtTimeAgo(p.created_at)}
                      </span>
                    </div>
                    <div className="mt-1 font-serif text-[15px] leading-snug text-text-primary line-clamp-2">
                      {stripHtml(p.title)}
                    </div>
                    {p.authors && p.authors.length > 0 && (
                      <div className="mt-1 text-caption text-text-secondary line-clamp-1">
                        {p.authors[p.authors.length - 1]}
                        {p.authors.length > 1 ? ", et al." : ""}
                      </div>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
