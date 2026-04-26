import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import type { Paper, Briefing } from "../lib/types";
import TIER_1_RAW from "../lib/tier1Journals.json";

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

// Single source of truth lives at clients/web/src/lib/tier1Journals.json,
// also loaded by ranking/journals.py — TS and Python can never drift.
function _normJournal(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}
const TIER_1_NORM: Set<string> = new Set(
  (TIER_1_RAW as string[]).map(_normJournal),
);
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

function isToday(d: string | null | undefined): boolean {
  if (!d) return false;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const dd = new Date(d.length === 10 ? d + "T00:00:00" : d);
  dd.setHours(0, 0, 0, 0);
  return today.getTime() === dd.getTime();
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
  const [newSinceLast, setNewSinceLast] = useState<number>(0);
  const [authorSeeds, setAuthorSeeds] = useState<string[]>([]);
  const [whyPaper, setWhyPaper] = useState<Paper | null>(null);
  const [focusedIdx, setFocusedIdx] = useState<number>(-1);
  const [todayBriefing, setTodayBriefing] = useState<Briefing | null>(null);
  const [profileSignedUpAt, setProfileSignedUpAt] = useState<string | null>(null);
  const longPressTimer = useRef<number | null>(null);
  const longPressed = useRef(false);
  const navigate = useNavigate();

  async function pinForLater(p: Paper) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error: err } = await supabase.from("pins").upsert(
      { user_id: user.id, paper_id: p.id },
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
    const [{ data: rows, error: err1 }, { data: pins }, visit, { data: seedRows }, { data: brief }] = await Promise.all([
      supabase
        .from("papers")
        .select("*", { count: "exact" })
        .or(`published_at.gte.${ninetyDaysAgo},published_at.is.null`)
        .order("relevance_score", { ascending: false })
        .limit(60),
      supabase.from("pins").select("paper_id"),
      supabase.rpc("ping_visit"),
      supabase.from("topic_seeds").select("value").eq("kind", "author"),
      supabase
        .from("briefings")
        .select()
        .order("briefing_date", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    setTodayBriefing((brief as Briefing | null) || null);

    // Track when this user came through onboarding so we can show the
    // "building your first feed" state for fresh sign-ups (vs. an
    // established user whose feed went genuinely quiet).
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.created_at) setProfileSignedUpAt(user.created_at);
    setAuthorSeeds(((seedRows as { value: string }[]) || []).map((r) => r.value));
    if (err1) setError(err1.message);
    if (visit?.data && Array.isArray(visit.data) && visit.data.length > 0) {
      const v = visit.data[0] as { prev_last_seen: string | null };
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

    // Freshness = when WE added it to the feed (created_at), not when
    // the journal printed it. Academic papers cycle for weeks; the
    // user's mental model is "what's new in MY feed since yesterday."
    // Three buckets: today, last 3 days, older. Within each, by relevance.
    const today = new Date(); today.setHours(0,0,0,0);
    const todayCutoff = today.getTime();
    const threeDayCutoff = todayCutoff - 3 * 24 * 60 * 60 * 1000;
    const freshnessBucket = (p: Paper): number => {
      const t = p.created_at ? Date.parse(p.created_at) : 0;
      if (t >= todayCutoff)    return 2; // added today
      if (t >= threeDayCutoff) return 1; // last 3 days
      return 0;
    };
    // Preprint dedup: when the same user has both a preprint and its
    // peer-reviewed published version in the feed, hide the preprint.
    // Match on either DOI direction (papers store the OTHER side's DOI
    // in published_doi for preprints, preprint_doi for published).
    const allDois = new Set(
      ((rows as Paper[]) || [])
        .map((p) => p.doi)
        .filter((d): d is string => !!d),
    );
    const ranked = ((rows as Paper[]) || [])
      .filter((p) => !isJunk(p.title))
      .filter((p) => {
        // If this paper is a preprint and its published_doi exists in
        // the feed, hide the preprint.
        if (p.published_doi && allDois.has(p.published_doi)) return false;
        return true;
      })
      .sort((a, b) => {
        const ab = freshnessBucket(a);
        const bb = freshnessBucket(b);
        if (ab !== bb) return bb - ab;
        return (b.relevance_score ?? 0) - (a.relevance_score ?? 0);
      })
      .slice(0, 20);

    setPapers(ranked);
    setPinnedIDs(new Set((pins || []).map((p: any) => p.paper_id)));
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  // Auto-poll while the feed is empty so a fresh user doesn't have to
  // hard-refresh once the pipeline lands their first papers. Polls every
  // 30s, only while the document is visible (no battery drain on a
  // background tab), and stops the moment papers arrive.
  useEffect(() => {
    if (papers.length > 0) return;
    if (loading) return;
    let cancelled = false;
    const interval = setInterval(() => {
      if (cancelled) return;
      if (document.visibilityState !== "visible") return;
      load();
    }, 30_000);
    return () => { cancelled = true; clearInterval(interval); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [papers.length, loading]);

  // Keyboard navigation: j/k = next/prev, Enter = open, p = pin/unpin,
  // ? = open the why-modal for the focused card. Disabled while a modal
  // is open or when typing in any input (to avoid intercepting form chars).
  useEffect(() => {
    function isTyping() {
      const t = document.activeElement;
      const tag = t?.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || (t as HTMLElement | null)?.isContentEditable;
    }
    function onKey(e: KeyboardEvent) {
      if (whyPaper) return;
      if (isTyping()) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (papers.length === 0) return;
      if (e.key === "j") {
        e.preventDefault();
        setFocusedIdx((i) => Math.min(papers.length - 1, (i < 0 ? 0 : i + 1)));
      } else if (e.key === "k") {
        e.preventDefault();
        setFocusedIdx((i) => Math.max(0, (i < 0 ? 0 : i - 1)));
      } else if (e.key === "Enter" && focusedIdx >= 0) {
        e.preventDefault();
        navigate(`/paper/${papers[focusedIdx].id}`);
      } else if (e.key === "p" && focusedIdx >= 0) {
        e.preventDefault();
        pinForLater(papers[focusedIdx]);
      } else if (e.key === "?" && focusedIdx >= 0) {
        e.preventDefault();
        setWhyPaper(papers[focusedIdx]);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [papers, focusedIdx, whyPaper, navigate]);

  // Scroll the focused card into view when it changes.
  useEffect(() => {
    if (focusedIdx < 0 || !papers[focusedIdx]) return;
    const el = document.getElementById(`feed-card-${papers[focusedIdx].id}`);
    if (el) el.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [focusedIdx, papers]);

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
        {newSinceLast > 0 && (
          <div className="mb-1">
            <span className="inline-flex items-center bg-jewel-sapphire text-white text-[11px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider shadow-sm">
              +{newSinceLast} new
            </span>
          </div>
        )}
        <h1 className="text-[34px] font-semibold text-text-primary leading-tight">
          {loading ? "Today" : morningGreeting(papers)}
        </h1>
        <p className="text-caption text-text-secondary mt-1">
          {loading ? "Loading your feed…" : (
            <>
              {papers.length} papers · latest first, then relevance
              {papers[0]?.created_at && (
                <span className="text-text-secondary/70">
                  {" · last refresh "}
                  {fmtDate(papers
                    .map((p) => p.created_at || "")
                    .sort()
                    .reverse()[0])}
                </span>
              )}
            </>
          )}
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

      {!loading && papers.length === 0 && (() => {
        // Fresh user (signed up < 24h ago and has no papers yet) gets the
        // optimistic "building" state with an ETA. Older users get the
        // genuine "your feed went quiet — add seeds" empty state.
        const isFresh =
          !!profileSignedUpAt &&
          (Date.now() - new Date(profileSignedUpAt).getTime()) < 24 * 60 * 60 * 1000;
        if (isFresh) {
          return (
            <div className="text-center py-12 px-4">
              <div className="relative inline-block mb-3">
                <div className="text-5xl">🛠️</div>
                <span className="absolute top-0 right-0 inline-flex h-2.5 w-2.5 rounded-full bg-jewel-emerald animate-ping" />
              </div>
              <p className="text-text-primary font-semibold mb-2">Building your first feed</p>
              <p className="text-caption text-text-secondary mb-2 max-w-xs mx-auto">
                Embedding your interests and ranking the last 60 days of
                PubMed against them.
              </p>
              <p className="text-caption text-text-secondary/70 max-w-xs mx-auto">
                Usually 10–20 minutes. This page will refresh on its own —
                no need to reload.
              </p>
              <div className="mt-5 inline-flex items-center gap-2 text-caption text-text-secondary/60">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-jewel-emerald animate-pulse" />
                checking every 30s
              </div>
            </div>
          );
        }
        return (
          <div className="text-center py-12 px-4">
            <div className="text-4xl mb-3">📂</div>
            <p className="text-text-primary font-medium mb-2">Your feed is quiet</p>
            <p className="text-caption text-text-secondary mb-5 max-w-xs mx-auto">
              The pipeline ranks new papers against your seeds. Add a few to bootstrap it — usually populates within an hour.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 justify-center max-w-xs mx-auto">
              <Link
                to="/settings/seeds"
                className="px-4 py-2.5 rounded-xl bg-jewel-emerald text-white text-sm font-semibold active:opacity-80"
              >
                + Add seeds
              </Link>
              <Link
                to="/settings/journals"
                className="px-4 py-2.5 rounded-xl bg-bg-card text-text-primary text-sm font-semibold border border-stroke active:opacity-80"
              >
                Pick journals
              </Link>
            </div>
          </div>
        );
      })()}

      {/* HERO — picks the freshest paper that has a real image, so the
          banner always carries a real figure (not the generated SVG fallback).
          Falls back to papers[0] if literally nothing has an image. */}
      {papers.length > 0 && (() => {
        const heroIdx = papers.findIndex((p) => !!p.hero_image_url);
        const heroSliceIdx = heroIdx >= 0 ? heroIdx : 0;
        const p = papers[heroSliceIdx];
        const chips = featureChips(p);
        const inst = p.last_author_institution || p.first_author_institution;
        return (
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
            className="block bg-bg-card rounded-card overflow-hidden mb-3 active:opacity-80 transition cursor-pointer select-none shadow-sm"
          >
            <HeroIllustration paper={p} />
            <div className="p-5">
              <div className="flex items-center justify-between gap-3 mb-2">
                <span className="text-eyebrow font-semibold text-text-secondary uppercase tracking-wider line-clamp-1">
                  {isTier1(p.journal) ? (
                    <span className="text-jewel-topaz mr-1" title="Top-tier journal">★</span>
                  ) : (
                    <span className="text-text-secondary/40 mr-1">·</span>
                  )}
                  {p.journal || "Unknown journal"}
                  {p.published_at && (
                    <span className="ml-2 normal-case tracking-normal text-text-secondary/70">
                      · {fmtDate(p.published_at)}
                    </span>
                  )}
                </span>
                {/* Hero deliberately omits the rank pill — its size says "headline". */}
              </div>
              <h2 className="text-[22px] font-semibold leading-snug text-text-primary line-clamp-3">
                {stripHtml(p.title)}
              </h2>
              {p.summary?.tldr && (
                <p className="mt-2.5 text-[15px] leading-relaxed text-text-primary line-clamp-4">
                  {stripHtml(p.summary.tldr)}
                </p>
              )}
              {chips.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {chips.map((c) => (
                    <span
                      key={c.label}
                      className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                        c.tone === "warm" ? "bg-accent/15 text-accent"
                          : c.tone === "accent" ? "bg-accent text-white"
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
                    className={`font-medium shrink-0 inline-block ${
                      burstPaperId === p.id
                        ? "animate-pin-burst text-jewel-topaz drop-shadow-[0_0_4px_rgba(168,133,58,0.55)]"
                        : "text-jewel-emerald"
                    }`}
                  >
                    ★ saved
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {whyPaper && (
        <WhyModal
          paper={whyPaper}
          authorSeeds={authorSeeds}
          onClose={() => setWhyPaper(null)}
        />
      )}

      {/* Today's briefing preview — only when audio is ready and the
          briefing covers today (don't tease yesterday's run). */}
      {todayBriefing?.audio_path && isToday(todayBriefing.briefing_date) && (
        <Link
          to="/briefing"
          className="block mb-4 bg-gradient-to-br from-jewel-emerald to-jewel-emerald/80 text-white rounded-card p-4 active:opacity-90 shadow-sm"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-eyebrow font-semibold uppercase tracking-wider opacity-80">
                Today's briefing — ready
              </div>
              <div className="mt-0.5 text-[15px] font-semibold leading-snug">
                {(todayBriefing.paper_ids || []).length} papers ·{" "}
                {todayBriefing.script_json?.audio_duration
                  ? `${Math.round(todayBriefing.script_json.audio_duration / 60)} min listen`
                  : "audio ready"}
              </div>
            </div>
            <div className="shrink-0 w-11 h-11 rounded-full bg-white/20 flex items-center justify-center text-xl">
              ▶
            </div>
          </div>
        </Link>
      )}

      <ul className="space-y-3">
        {papers
          .map((p, idx) => ({ p, idx }))
          .filter(({ idx }) => {
            // Skip whichever paper got promoted to the hero card.
            const heroIdx = papers.findIndex((p) => !!p.hero_image_url);
            return idx !== (heroIdx >= 0 ? heroIdx : 0);
          })
          .map(({ p: paperRaw, idx: i }) => {
          const p = paperRaw;
          const chips = featureChips(p);
          const inst = p.last_author_institution || p.first_author_institution;
          return (
            <li key={p.id} id={`feed-card-${p.id}`}>
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
                className={`block bg-bg-card rounded-card overflow-hidden active:opacity-80 transition cursor-pointer select-none ${
                  papers[focusedIdx]?.id === p.id
                    ? "ring-2 ring-jewel-emerald ring-offset-2 ring-offset-bg-primary"
                    : ""
                }`}
              >
                <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <span className="text-eyebrow font-semibold text-text-secondary uppercase tracking-wider line-clamp-1">
                    {isTier1(p.journal) ? (
                      <span className="text-jewel-topaz mr-1" title="Top-tier journal">★</span>
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
                  <div className="flex items-center gap-1.5 shrink-0">
                    <RelevancePill rank={rankByIndex[i]} total={papers.length} />
                    <button
                      onClick={(e) => { e.stopPropagation(); setWhyPaper(p); }}
                      onMouseDown={(e) => e.stopPropagation()}
                      onTouchStart={(e) => e.stopPropagation()}
                      aria-label="Why am I seeing this?"
                      className="text-text-secondary/60 hover:text-text-primary text-[11px] w-5 h-5 rounded-full border border-text-secondary/30 flex items-center justify-center"
                    >
                      ?
                    </button>
                  </div>
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
                  <p className="mt-3 font-serif text-[15px] leading-snug text-text-primary line-clamp-4">
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
                      className={`font-medium shrink-0 transition-all inline-block ${
                        burstPaperId === p.id
                          ? "animate-pin-burst text-jewel-topaz drop-shadow-[0_0_4px_rgba(168,133,58,0.55)]"
                          : "text-jewel-emerald"
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

// Hero banner illustration. Uses the publisher's hero image when present;
// otherwise generates a deterministic warm-cream geometric illustration
// keyed on the paper title so the same paper always looks the same.
function HeroIllustration({ paper }: { paper: Paper }) {
  if (paper.hero_image_url) {
    return (
      <div className="w-full aspect-[16/8] overflow-hidden bg-bg-primary relative">
        <img
          src={paper.hero_image_url}
          alt=""
          className="w-full h-full object-cover"
          loading="eager"
          referrerPolicy="no-referrer"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
        {/* Subtle bottom fade so card text reads cleanly below */}
        <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-bg-card to-transparent pointer-events-none" />
      </div>
    );
  }
  // Fallback: hand-drawn paper-stack illustration with deterministic colors.
  // Hashes the title so the same paper consistently picks the same palette.
  const seed = (paper.title || paper.id || "x")
    .split("")
    .reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 0);
  const palettes = [
    { bg: "#F4EDDD", a: "#B86E4C", b: "#3F6E55", c: "#A8853A" }, // terracotta + emerald + topaz
    { bg: "#F4EDDD", a: "#3B557F", b: "#B86E4C", c: "#6B4D78" }, // sapphire + terracotta + amethyst
    { bg: "#F4EDDD", a: "#8C3F4C", b: "#A8853A", c: "#3F6E55" }, // ruby + topaz + emerald
    { bg: "#F4EDDD", a: "#3F6E55", b: "#3B557F", c: "#A8853A" }, // emerald + sapphire + topaz
  ];
  const pal = palettes[seed % palettes.length];
  const tilt1 = -7 + ((seed >> 3) % 6);
  const tilt2 = 4 + ((seed >> 7) % 6);
  return (
    <div
      className="w-full aspect-[16/8] overflow-hidden relative"
      style={{ background: pal.bg }}
    >
      <svg
        viewBox="0 0 320 160"
        className="w-full h-full"
        preserveAspectRatio="xMidYMid slice"
      >
        {/* faint paper grid in background */}
        <defs>
          <pattern id={`grid-${seed}`} width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#2E2A24" strokeWidth="0.4" opacity="0.06" />
          </pattern>
        </defs>
        <rect width="320" height="160" fill={`url(#grid-${seed})`} />
        {/* coffee-ring stain */}
        <g opacity="0.22">
          <circle cx={50 + (seed % 30)} cy="120" r="22" fill="none" stroke={pal.a} strokeWidth="3" />
          <circle cx={50 + (seed % 30)} cy="120" r="22" fill="none" stroke="#2E2A24" strokeWidth="0.8" opacity="0.4" />
        </g>
        {/* back paper */}
        <g transform={`translate(80 18) rotate(${tilt1})`}>
          <rect width="140" height="120" rx="6" fill="#FDFAF1" stroke="#2E2A24" strokeWidth="1.4" opacity="0.9" />
          <rect x="14" y="14" width="80" height="6" rx="1.5" fill={pal.a} opacity="0.6" />
          <rect x="14" y="28" width="110" height="3" rx="1" fill="#2E2A24" opacity="0.5" />
          <rect x="14" y="36" width="100" height="3" rx="1" fill="#2E2A24" opacity="0.5" />
          <rect x="14" y="44" width="105" height="3" rx="1" fill="#2E2A24" opacity="0.5" />
          {/* mini chart */}
          <g transform="translate(14 60)">
            <line x1="0" y1="40" x2="100" y2="40" stroke="#2E2A24" strokeWidth="0.8" opacity="0.5" />
            <path d="M 0 35 Q 20 28 40 22 T 80 8 L 100 4" fill="none" stroke={pal.b} strokeWidth="2" />
            <circle cx="20" cy="28" r="2" fill={pal.b} />
            <circle cx="40" cy="22" r="2" fill={pal.b} />
            <circle cx="60" cy="14" r="2" fill={pal.b} />
            <circle cx="80" cy="8"  r="2" fill={pal.b} />
          </g>
        </g>
        {/* front paper */}
        <g transform={`translate(150 38) rotate(${tilt2})`}>
          <rect width="140" height="115" rx="6" fill="#FDFAF1" stroke="#2E2A24" strokeWidth="1.4" />
          {/* highlighter streak */}
          <rect x="14" y="22" width="92" height="9" rx="2" fill={pal.a} opacity="0.32" />
          <rect x="14" y="14" width="92" height="6" rx="1.5" fill="#2E2A24" />
          <rect x="14" y="26" width="80" height="3" rx="1" fill="#2E2A24" opacity="0.85" />
          {/* protein-blob sketch */}
          <g transform="translate(14 44)" fill="none" stroke="#2E2A24" strokeWidth="1.4" strokeLinecap="round">
            <path d="M 6 30 Q 22 8 46 18 Q 72 28 78 8" />
            <path d="M 78 8 Q 92 18 88 36 Q 78 50 60 46" />
            <path d="M 60 46 L 6 46 L 6 42 L -2 50 L 6 58 L 6 54 L 60 54 Z"
                  fill={pal.c} opacity="0.7" stroke="#2E2A24" strokeWidth="1.2" />
            <circle cx="40" cy="28" r="3" fill={pal.b} />
          </g>
          <rect x="14" y="100" width="60" height="3" rx="1" fill="#2E2A24" opacity="0.45" />
        </g>
        {/* paperclip */}
        <g transform={`translate(282 30) rotate(${tilt2})`} fill="none" stroke="#2E2A24" strokeWidth="1.5" strokeLinecap="round">
          <path d="M 0 0 L 0 26 Q 0 30 4 30 L 14 30 Q 18 30 18 26 L 18 4 Q 18 0 14 0 L 8 0 Q 4 0 4 4 L 4 24" />
        </g>
      </svg>
      <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-bg-card to-transparent pointer-events-none" />
    </div>
  );
}

function WhyModal({
  paper,
  authorSeeds,
  onClose,
}: {
  paper: Paper;
  authorSeeds: string[];
  onClose: () => void;
}) {
  // Match seeded authors against paper authors. PubMed format is "Lastname II"
  // (e.g. "Hanash AM"). We compare on lastname (first token, lowercased).
  const paperLastNames = new Set(
    (paper.authors || []).map((a) => (a.split(/[\s,]+/)[0] || "").toLowerCase()),
  );
  const matchedAuthors = authorSeeds.filter((s) =>
    paperLastNames.has((s.split(/[\s,]+/)[0] || "").toLowerCase()),
  );
  const tier1 = isTier1(paper.journal);
  const score = paper.relevance_score;
  const reason = paper.summary?.relevance?.reason;
  const tags = paper.summary?.tags_suggested || [];

  return (
    <div
      className="fixed inset-0 z-30 bg-text-primary/40 flex items-end sm:items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-bg-card rounded-card p-5 space-y-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-lg font-semibold text-text-primary">
            Why you're seeing this
          </h3>
          <button
            onClick={onClose}
            className="text-text-secondary text-xl leading-none px-1"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <Row label="Journal tier">
          {tier1 ? (
            <span className="text-jewel-topaz font-medium">
              ★ Top-tier — included by default
            </span>
          ) : (
            <span className="text-text-secondary">
              Discovery — outside your top-journal list, surfaced by relevance or author match
            </span>
          )}
          {paper.journal && (
            <span className="text-text-secondary"> · {paper.journal}</span>
          )}
        </Row>

        {typeof score === "number" && (
          <Row label="Relevance">
            <span className="font-mono text-text-primary">
              {(score * 100).toFixed(1)}%
            </span>
            <span className="text-text-secondary"> cosine to your seeds</span>
          </Row>
        )}

        {matchedAuthors.length > 0 && (
          <Row label="Followed authors on this paper">
            <div className="flex flex-wrap gap-1.5 mt-1">
              {matchedAuthors.map((a) => (
                <span
                  key={a}
                  className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-jewel-emerald/15 text-jewel-emerald"
                >
                  {a}
                </span>
              ))}
            </div>
          </Row>
        )}

        {reason && (
          <Row label="Editorial note">
            <span className="text-text-primary">{reason}</span>
          </Row>
        )}

        {tags.length > 0 && (
          <Row label="Tags">
            <div className="flex flex-wrap gap-1.5 mt-1">
              {tags.slice(0, 6).map((t) => (
                <span
                  key={t}
                  className="text-[11px] px-2 py-0.5 rounded-full bg-bg-primary text-text-secondary"
                >
                  {t}
                </span>
              ))}
            </div>
          </Row>
        )}
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-eyebrow font-semibold text-text-secondary uppercase tracking-wider mb-0.5">
        {label}
      </div>
      <div className="text-sm">{children}</div>
    </div>
  );
}

function RelevancePill({ rank, total }: { rank: number; total: number }) {
  if (total === 0) return null;
  const pct = (rank / total);
  // Use semantic labels paired with jewel tones — "Strong match" reads as
  // useful signal where "#3" reads as a leaderboard ranking.
  const [label, bg] =
    pct < 0.25 ? ["Strong match", "bg-jewel-emerald"] :
    pct < 0.6  ? ["Worth a look", "bg-jewel-topaz"]   :
                  ["Discovery",   "bg-relevance-low"];
  return (
    <span className={`text-white text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full whitespace-nowrap ${bg}`}>
      {label}
    </span>
  );
}
