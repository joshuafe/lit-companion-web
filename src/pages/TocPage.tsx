import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase, SUPABASE_URL } from "../lib/supabase";
import SwipeRow from "../components/SwipeRow";

interface TocItem {
  title: string;
  link: string | null;
  pub_date: string | null;
  pub_ts: number | null;
  authors: string[];
  abstract: string | null;
  doi: string | null;
  journal: string;
}

interface AggregateResponse {
  mode: "aggregate";
  journals: { journal: string; count: number; error?: string }[];
  fetched_at: string;
  count: number;
  items: TocItem[];
}

function fmtAge(ts: number | null): string {
  if (!ts) return "";
  const ms = Date.now() - ts;
  const min = Math.floor(ms / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  if (days < 14) return `${days}d ago`;
  const d = new Date(ts);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function dayLabel(ts: number | null): string {
  if (!ts) return "Unknown date";
  const t = new Date(); t.setHours(0, 0, 0, 0);
  const d = new Date(ts); d.setHours(0, 0, 0, 0);
  const days = Math.round((t.getTime() - d.getTime()) / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
}

function strip(s: string | null | undefined): string {
  if (!s) return "";
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export default function TocPage() {
  const [preferredJournals, setPreferredJournals] = useState<string[]>([]);
  const [data, setData] = useState<AggregateResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [journalFilter, setJournalFilter] = useState<string | null>(null);
  const [pinningId, setPinningId] = useState<string | null>(null);
  const [pinnedKeys, setPinnedKeys] = useState<Set<string>>(new Set());
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      const { data: profile } = await supabase
        .from("profiles")
        .select("suggested_journals")
        .maybeSingle();
      const raw = (profile?.suggested_journals as { name: string }[] | string[]) || [];
      const names = raw.map((x: any) => typeof x === "string" ? x : x.name).filter(Boolean);
      setPreferredJournals(names);

      if (names.length === 0) { setLoading(false); return; }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setError("Not signed in"); setLoading(false); return; }

      try {
        const res = await fetch(
          `${SUPABASE_URL}/functions/v1/journal-toc?journals=${encodeURIComponent(names.join(","))}`,
          { headers: { Authorization: `Bearer ${session.access_token}` } },
        );
        const body = await res.json();
        if (!res.ok) {
          setError(body.message || body.error || `Fetch failed (${res.status})`);
        } else {
          setData(body as AggregateResponse);
        }
      } catch (e: any) {
        setError(e.message);
      }
      setLoading(false);
    })();
  }, []);

  // Items filtered + grouped by day for readable scanning.
  const filteredItems = useMemo(() => {
    if (!data) return [];
    if (!journalFilter) return data.items;
    return data.items.filter((i) => i.journal === journalFilter);
  }, [data, journalFilter]);

  const groups = useMemo(() => {
    const out: { day: string; items: TocItem[] }[] = [];
    let currentDayKey: string | null = null;
    for (const item of filteredItems) {
      const dayKey = item.pub_ts
        ? new Date(item.pub_ts).toISOString().slice(0, 10)
        : "unknown";
      if (dayKey !== currentDayKey) {
        currentDayKey = dayKey;
        out.push({ day: dayLabel(item.pub_ts), items: [] });
      }
      out[out.length - 1].items.push(item);
    }
    return out;
  }, [filteredItems]);

  // The unique key for an RSS item is its DOI (best) or its link.
  function itemKey(item: TocItem): string {
    return (item.doi || item.link || item.title).trim();
  }

  // Pin: upsert a paper row from the RSS metadata, then upsert the pin.
  // Mirrors the AddPaperPage flow but skipping PDF + Crossref — we use
  // exactly what the publisher RSS gave us, no enrichment.
  async function pinItem(item: TocItem) {
    const key = itemKey(item);
    if (!key) return;
    setPinningId(key);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setFlash("Not signed in"); return; }
      const sourceId = item.doi || item.link || `rss:${key.slice(0, 80)}`;
      const paperRow = {
        user_id: user.id,
        source: "rss_pin",
        source_id: sourceId,
        doi: item.doi || null,
        title: item.title || "(untitled)",
        authors: item.authors || [],
        journal: item.journal,
        published_at: item.pub_ts ? new Date(item.pub_ts).toISOString() : null,
        abstract: item.abstract,
        url: item.link || (item.doi ? `https://doi.org/${item.doi}` : ""),
      };
      const { data: paperData, error: paperErr } = await supabase
        .from("papers")
        .upsert(paperRow, { onConflict: "user_id,source,source_id" })
        .select("id")
        .single();
      if (paperErr || !paperData) {
        setFlash(`Pin failed: ${paperErr?.message || "no row returned"}`);
        return;
      }
      await supabase
        .from("pins")
        .upsert(
          { user_id: user.id, paper_id: paperData.id },
          { onConflict: "user_id,paper_id" },
        );
      setPinnedKeys((s) => new Set(s).add(key));
      setFlash(`★ Saved "${item.title.slice(0, 50)}…"`);
      if (navigator.vibrate) navigator.vibrate([18, 30, 12]);
    } finally {
      setPinningId(null);
      setTimeout(() => setFlash(null), 2200);
    }
  }

  // Per-journal counts for the chip row.
  const journalCounts = useMemo(() => {
    if (!data) return new Map<string, number>();
    const m = new Map<string, number>();
    for (const it of data.items) m.set(it.journal, (m.get(it.journal) || 0) + 1);
    return m;
  }, [data]);
  const journalChips = useMemo(
    () => Array.from(journalCounts.entries()).sort((a, b) => b[1] - a[1]),
    [journalCounts],
  );

  return (
    <div className="max-w-lg lg:max-w-4xl mx-auto px-5 lg:px-10 pt-10 pb-32">
      <div className="flex items-center gap-3 mb-2">
        <Link to="/" className="text-jewel-emerald text-sm font-medium">
          ‹ Feed
        </Link>
        <span className="text-eyebrow font-semibold text-text-secondary uppercase tracking-wider">
          Live publisher RSS
        </span>
      </div>
      <h1 className="text-[34px] font-semibold text-text-primary leading-tight">
        Journal TOC
      </h1>
      {data && (
        <p className="text-caption text-text-secondary mt-1">
          {data.count} items across {data.journals.length} journals · pulled
          live · {fmtAge(Date.parse(data.fetched_at))}
        </p>
      )}

      {/* Journal filter chips */}
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
            All ({data?.count ?? 0})
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

      {error && (
        <div className="mt-6 bg-red-50 text-red-700 rounded-xl p-3 text-sm">
          {error}
        </div>
      )}

      {loading && (
        <div className="mt-8 text-center text-caption text-text-secondary">
          Pulling live feeds…
        </div>
      )}

      {!loading && preferredJournals.length === 0 && (
        <div className="mt-8 bg-bg-card rounded-2xl p-4 text-caption text-text-secondary">
          No preferred journals yet.{" "}
          <Link to="/settings/journals" className="text-jewel-emerald font-medium">
            Pick a starting set →
          </Link>
        </div>
      )}

      {/* Per-journal status row when some failed */}
      {data && data.journals.some((j) => j.error) && (
        <div className="mt-4 text-caption text-text-secondary/70">
          {data.journals
            .filter((j) => j.error)
            .map((j) => `${j.journal}: ${j.error === "no_feed_url" ? "no RSS URL on file" : j.error}`)
            .join(" · ")}
        </div>
      )}

      <div className="mt-6 space-y-6">
        {groups.map(({ day, items }) => (
          <section key={day}>
            <div className="text-eyebrow font-semibold text-text-secondary uppercase tracking-wider mb-2">
              {day}{" "}
              <span className="text-text-secondary/60 font-normal">· {items.length}</span>
            </div>
            <ul className="space-y-2 lg:space-y-0 lg:columns-2 lg:gap-2 [&>li]:lg:break-inside-avoid [&>li]:lg:mb-2">
              {items.map((item, i) => {
                const key = itemKey(item);
                const pinned = pinnedKeys.has(key);
                return (
                  <li key={`${day}-${i}`}>
                    <SwipeRow
                      onTap={() => item.link && window.open(item.link, "_blank", "noopener,noreferrer")}
                      swipeRight={
                        pinned
                          ? undefined
                          : { label: "★ Pin", bg: "bg-jewel-topaz", onCommit: () => pinItem(item) }
                      }
                    >
                      <div className="bg-bg-card p-3 flex items-start gap-3 cursor-pointer select-none">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline justify-between gap-2 mb-1">
                            <span className="text-eyebrow font-semibold text-text-secondary uppercase tracking-wider line-clamp-1">
                              {item.journal}
                            </span>
                            <span className="text-[10px] font-mono text-text-secondary/70 shrink-0">
                              {fmtAge(item.pub_ts)}
                            </span>
                          </div>
                          <div className="font-serif text-[15px] leading-snug text-text-primary line-clamp-3">
                            {strip(item.title)}
                          </div>
                          {item.authors.length > 0 && (
                            <div className="mt-1 text-caption text-text-secondary line-clamp-1">
                              {item.authors.slice(0, 4).join(", ")}
                              {item.authors.length > 4 ? ", et al." : ""}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); pinItem(item); }}
                          disabled={pinned || pinningId === key}
                          className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold transition ${
                            pinned
                              ? "bg-jewel-emerald/15 text-jewel-emerald cursor-default"
                              : "bg-jewel-topaz text-white active:opacity-80 disabled:opacity-50"
                          }`}
                          aria-label={pinned ? "Already pinned" : "Pin to library"}
                        >
                          {pinned ? "✓" : pinningId === key ? "…" : "★"}
                        </button>
                      </div>
                    </SwipeRow>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      {flash && (
        <div className="fixed bottom-24 inset-x-0 flex justify-center px-4 z-20 pointer-events-none">
          <div className="bg-text-primary text-bg-primary text-sm px-4 py-2 rounded-full shadow-lg">
            {flash}
          </div>
        </div>
      )}
    </div>
  );
}
