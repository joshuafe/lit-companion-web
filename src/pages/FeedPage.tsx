import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import type { Paper } from "../lib/types";

const LONG_PRESS_MS = 500;

// Soft "saved-it" chime — short FM blip via Web Audio API. No asset to ship.
function playPinChime() {
  try {
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const now = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(880, now);
    o.frequency.exponentialRampToValueAtTime(1320, now + 0.18);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.18, now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.30);
    o.connect(g).connect(ctx.destination);
    o.start(now);
    o.stop(now + 0.32);
  } catch {
    /* ignore — no AudioContext, muted device, etc. */
  }
}

function morningGreeting(papers: Paper[]): string {
  const hour = new Date().getHours();
  const greet =
    hour < 5  ? "Burning the midnight oil." :
    hour < 12 ? "Good morning." :
    hour < 17 ? "Good afternoon." :
    hour < 22 ? "Good evening." :
    "Up late.";
  const t1 = papers.filter((p) => isTier1(p.journal)).length;
  if (papers.length === 0) return greet;
  if (t1 === 0) return `${greet} A few discovery picks today.`;
  if (t1 === papers.length) return `${greet} ${t1} from your top journals.`;
  return `${greet} ${t1} from your top journals, plus ${papers.length - t1} discovery.`;
}

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

// Mirror of ranking/journals.py TIER_1. Keep these in sync.
const TIER_1_NORM = new Set<string>([
  "nature", "cell", "science", "n engl j med", "new england journal of medicine",
  "blood", "blood adv", "blood advances", "blood neoplasia",
  "j clin oncol", "journal of clinical oncology",
  "bone marrow transplant", "bone marrow transplantation",
  "transplant cell ther", "transplantation and cellular therapy",
  "leukemia", "exp hematol", "experimental hematology",
  "immunity", "j exp med", "journal of experimental medicine",
  "nat immunol", "nature immunology",
  "nat rev immunol", "nature reviews immunology",
  "nat med", "nature medicine",
  "j clin invest", "journal of clinical investigation",
  "jci insight",
]);
function isTier1(journal: string | null | undefined): boolean {
  if (!journal) return false;
  const n = journal.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  if (TIER_1_NORM.has(n)) return true;
  // Multi-token prefix-window match for ISO abbreviations like "Blood Adv" → "Blood advances".
  const tokens = n.split(" ");
  for (const pat of TIER_1_NORM) {
    const pTokens = pat.split(" ");
    if (pTokens.length < 2 || pTokens.length > tokens.length) continue;
    outer: for (let start = 0; start <= tokens.length - pTokens.length; start++) {
      for (let i = 0; i < pTokens.length; i++) {
        const t = tokens[start + i];
        const p = pTokens[i];
        if (t !== p && !(p.length >= 3 && t.startsWith(p))) continue outer;
      }
      return true;
    }
  }
  return false;
}

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
  if (
    title.startsWith("review") || title.includes(" review ") ||
    title.includes("systematic review") || title.includes("meta-analysis") ||
    title.startsWith("hallmarks of") || title.includes("perspective") ||
    title.startsWith("snapshot") || title.includes("opinion:") ||
    /\b(the|a)\s+(road ahead|way forward|state of)\b/.test(title) ||
    p.journal?.toLowerCase().includes("nat rev") ||
    p.journal?.toLowerCase().includes("reviews") ||
    p.journal?.toLowerCase().includes("trends in") ||
    p.journal?.toLowerCase().includes("current opinion") ||
    p.journal?.toLowerCase().includes("annual review")
  ) {
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
  const [flash, setFlash] = useState<string | null>(null);
  const [burstPaperId, setBurstPaperId] = useState<string | null>(null);
  const [streakDays, setStreakDays] = useState<number | null>(null);
  const [newSinceLast, setNewSinceLast] = useState<number>(0);
  const longPressTimer = useRef<number | null>(null);
  const longPressed = useRef(false);
  const navigate = useNavigate();

  async function pinForLater(p: Paper) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error: err } = await supabase.from("pins").upsert(
      { user_id: user.id, paper_id: p.id, note: "saved for later (long-press)" },
      { onConflict: "user_id,paper_id" },
    );
    if (err) {
      setFlash(`Error: ${err.message}`);
    } else {
      setPinnedIDs((s) => new Set(s).add(p.id));
      setBurstPaperId(p.id);
      setTimeout(() => setBurstPaperId(null), 700);
      setFlash(`★ Saved "${p.title.slice(0, 48)}…"`);
      if (navigator.vibrate) navigator.vibrate([18, 30, 12]);
      playPinChime();
    }
    setTimeout(() => setFlash(null), 2000);
  }

  function startLongPress(p: Paper) {
    longPressed.current = false;
    longPressTimer.current = window.setTimeout(() => {
      longPressed.current = true;
      pinForLater(p);
    }, LONG_PRESS_MS);
  }
  function cancelLongPress() {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }
  function handleNav(e: React.MouseEvent, paperId: string) {
    if (longPressed.current) {
      e.preventDefault();
      return;
    }
    navigate(`/paper/${paperId}`);
  }

  async function load() {
    setLoading(true);
    setError(null);
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
      .toISOString().slice(0, 10);
    // Ping the visit RPC alongside the data fetch so streak + new-since
    // counts are always fresh on Feed open.
    const [{ data: rows, error: err1 }, { data: pins }, visit] = await Promise.all([
      supabase
        .from("papers")
        .select("*", { count: "exact" })
        .or(`published_at.gte.${ninetyDaysAgo},published_at.is.null`)
        .order("relevance_score", { ascending: false })
        .limit(60),
      supabase.from("pins").select("paper_id"),
      supabase.rpc("ping_visit"),
    ]);
    if (err1) setError(err1.message);
    if (visit?.data && Array.isArray(visit.data) && visit.data.length > 0) {
      const v = visit.data[0] as { prev_last_seen: string | null; streak_days: number };
      setStreakDays(v.streak_days);
      if (v.prev_last_seen) {
        const cutoff = Date.parse(v.prev_last_seen);
        const newCount = ((rows as Paper[]) || []).filter(
          (p) => p.created_at && Date.parse(p.created_at) > cutoff,
        ).length;
        setNewSinceLast(newCount);
      } else {
        setNewSinceLast(0);
      }
    }

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
        <div className="flex items-center gap-2 mb-1">
          {streakDays && streakDays > 1 && (
            <span
              className="inline-flex items-center gap-1 bg-accent/10 text-accent text-[11px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider"
              title={`${streakDays} consecutive days reading`}
            >
              🔥 {streakDays}-day streak
            </span>
          )}
          {newSinceLast > 0 && (
            <span className="inline-flex items-center bg-accent text-white text-[11px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider">
              +{newSinceLast} new
            </span>
          )}
        </div>
        <h1 className="text-[34px] font-semibold text-text-primary leading-tight">
          {loading ? "Today" : morningGreeting(papers)}
        </h1>
        <p className="text-caption text-text-secondary mt-1">
          {loading
            ? "Loading your feed…"
            : `${papers.length} papers · latest first, then relevance`}
        </p>
      </header>

      {error && <div className="text-sm text-red-600 mb-4">{error}</div>}

      {flash && (
        <div className="fixed bottom-24 inset-x-0 flex justify-center px-4 z-20 pointer-events-none">
          <div className="bg-text-primary text-bg-primary text-sm px-4 py-2 rounded-full shadow-lg">
            {flash}
          </div>
        </div>
      )}

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
              <div
                role="button"
                tabIndex={0}
                onClick={(e) => handleNav(e as any, p.id)}
                onKeyDown={(e) => { if (e.key === "Enter") navigate(`/paper/${p.id}`); }}
                onTouchStart={() => startLongPress(p)}
                onTouchEnd={cancelLongPress}
                onTouchMove={cancelLongPress}
                onTouchCancel={cancelLongPress}
                onMouseDown={() => startLongPress(p)}
                onMouseUp={cancelLongPress}
                onMouseLeave={cancelLongPress}
                onContextMenu={(e) => { e.preventDefault(); pinForLater(p); }}
                className="block bg-bg-card rounded-card overflow-hidden active:opacity-80 transition cursor-pointer select-none"
              >
                <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <span className="text-eyebrow font-semibold text-text-secondary uppercase tracking-wider line-clamp-1">
                    {isTier1(p.journal) ? (
                      <span className="text-accent mr-1" title="Top-tier journal">★</span>
                    ) : (
                      <span className="text-text-secondary/40 mr-1" title="Discovery — exceptional relevance or familiar author">·</span>
                    )}
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

                {p.hero_image_url && (
                  <div className="mt-3 -mx-4 aspect-[16/7] overflow-hidden bg-bg-primary">
                    <img
                      src={p.hero_image_url}
                      alt=""
                      className="w-full h-full object-cover"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        (e.target as HTMLImageElement).parentElement?.remove();
                      }}
                    />
                  </div>
                )}

                {p.summary?.tldr && (
                  <p className="mt-3 text-caption text-text-primary line-clamp-3">
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
                    <span
                      className={`text-accent font-medium shrink-0 transition-transform ${
                        burstPaperId === p.id ? "animate-pin-burst" : ""
                      }`}
                    >
                      ★ saved
                    </span>
                  )}
                </div>
                </div>
              </div>
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
