import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import type { Paper } from "../lib/types";
import { stripHtml } from "../lib/text";

// Reading deck — full-page swipeable cards for dog-eared papers.
//
// Mental model: a focused reading queue separate from the long-term
// Library. Each paper takes the full viewport so you can actually read
// it; horizontal swipe / tap arrows / left-right keys navigate. Pinning
// or dismissing a paper from the deck removes its dog-ear (the intent
// has resolved).

interface DogEarRow {
  paper_id: string;
  dogeared_at: string;
  papers: Paper | null;
}

export default function ReadingPage() {
  const [rows, setRows] = useState<DogEarRow[]>([]);
  const [idx, setIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const startX = useRef<number | null>(null);
  const navigate = useNavigate();

  async function load() {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from("dog_ears")
      .select("paper_id, dogeared_at, papers(*)")
      .order("dogeared_at", { ascending: false });
    if (err) setError(err.message);
    setRows(((data as unknown) as DogEarRow[]) || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  // Cap idx in bounds when rows change (e.g. after a remove).
  useEffect(() => {
    if (idx >= rows.length) setIdx(Math.max(0, rows.length - 1));
  }, [rows.length, idx]);

  // Keyboard nav.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") { e.preventDefault(); next(); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); prev(); }
      else if (e.key === "Escape") { e.preventDefault(); navigate("/"); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows.length, idx]);

  function next() { if (idx < rows.length - 1) setIdx(idx + 1); }
  function prev() { if (idx > 0) setIdx(idx - 1); }

  // Swipe gesture — touch on mobile.
  function onTouchStart(e: React.TouchEvent) { startX.current = e.touches[0].clientX; }
  function onTouchEnd(e: React.TouchEvent) {
    if (startX.current == null) return;
    const dx = e.changedTouches[0].clientX - startX.current;
    startX.current = null;
    if (Math.abs(dx) < 50) return;
    if (dx < 0) next(); else prev();
  }

  // Remove the dog-ear (when user pins, dismisses, or unfolds explicitly).
  async function removeFromDeck(paperId: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("dog_ears").delete()
      .eq("user_id", user.id).eq("paper_id", paperId);
    setRows((rs) => rs.filter((r) => r.paper_id !== paperId));
  }
  async function pinAndAdvance(p: Paper) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("pins").upsert(
      { user_id: user.id, paper_id: p.id },
      { onConflict: "user_id,paper_id" },
    );
    await removeFromDeck(p.id);
    setFlash("★ Saved to Library");
    if (navigator.vibrate) navigator.vibrate([18, 30, 12]);
    setTimeout(() => setFlash(null), 1600);
  }
  async function dismissAndAdvance(p: Paper) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("dismissals").upsert({ user_id: user.id, paper_id: p.id });
    await removeFromDeck(p.id);
    setFlash("Dismissed");
    setTimeout(() => setFlash(null), 1400);
  }
  async function unfold(p: Paper) {
    await removeFromDeck(p.id);
    setFlash("Unfolded");
    setTimeout(() => setFlash(null), 1200);
  }

  const current = rows[idx]?.papers || null;

  return (
    <div
      className="min-h-screen bg-bg-primary"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div className="max-w-3xl mx-auto px-5 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-4">
          <Link to="/" className="text-jewel-emerald text-sm font-medium">‹ Feed</Link>
          <div className="text-eyebrow font-semibold text-text-secondary uppercase tracking-wider">
            Reading
          </div>
          <div className="text-caption text-text-secondary font-mono">
            {rows.length > 0 ? `${idx + 1} / ${rows.length}` : ""}
          </div>
        </div>

        {error && <div className="text-sm text-red-600 mb-3">{error}</div>}
        {loading && (
          <div className="text-center text-text-secondary py-12">Loading…</div>
        )}

        {!loading && rows.length === 0 && (
          <EmptyDeck />
        )}

        {!loading && current && (
          <ReadingCard
            paper={current}
            onPin={() => pinAndAdvance(current)}
            onDismiss={() => dismissAndAdvance(current)}
            onUnfold={() => unfold(current)}
          />
        )}

        {rows.length > 1 && (
          <div className="mt-6 flex items-center justify-between gap-4">
            <button
              onClick={prev}
              disabled={idx === 0}
              className="text-text-primary text-sm font-medium px-4 py-2 rounded-xl bg-bg-card border border-stroke disabled:opacity-30"
            >
              ‹ Prev
            </button>
            <ProgressDots count={rows.length} active={idx} onJump={setIdx} />
            <button
              onClick={next}
              disabled={idx === rows.length - 1}
              className="text-text-primary text-sm font-medium px-4 py-2 rounded-xl bg-bg-card border border-stroke disabled:opacity-30"
            >
              Next ›
            </button>
          </div>
        )}

        {flash && (
          <div className="fixed bottom-24 inset-x-0 flex justify-center px-4 z-20 pointer-events-none">
            <div className="bg-text-primary text-bg-primary text-sm px-4 py-2 rounded-full shadow-lg">
              {flash}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ReadingCard({
  paper, onPin, onDismiss, onUnfold,
}: {
  paper: Paper;
  onPin: () => void;
  onDismiss: () => void;
  onUnfold: () => void;
}) {
  const s = paper.summary;
  const inst = paper.last_author_institution || paper.first_author_institution;
  return (
    <article className="bg-bg-card rounded-2xl p-6 sm:p-8 shadow-sm relative">
      {/* Visible "folded corner" marker so the page reads as 'this is the
          one you saved'. Decorative — no click handler. */}
      <div
        className="absolute top-0 right-0 pointer-events-none"
        style={{ width: 44, height: 44 }}
      >
        <svg width="44" height="44" viewBox="0 0 44 44">
          <polygon points="0,0 44,0 0,44" fill="#E0D5BA" opacity="0.55" />
          <polygon points="44,0 44,22 22,0" fill="#B89039" stroke="#8C6B22" strokeWidth="0.6" />
        </svg>
      </div>

      <div className="text-eyebrow font-semibold text-text-secondary uppercase tracking-wider">
        {paper.journal || "Unknown journal"}
      </div>
      <h1 className="mt-2 text-[26px] sm:text-[30px] font-semibold leading-tight text-text-primary pr-12">
        {stripHtml(paper.title)}
      </h1>
      <div className="mt-2 text-caption text-text-secondary">
        {(paper.authors || []).slice(0, 6).join(", ")}
        {paper.authors?.length > 6 ? ", et al." : ""}
        {inst && <span className="text-text-secondary/80"> · {inst}</span>}
      </div>

      {paper.hero_image_url && (
        <div className="mt-5 -mx-6 sm:-mx-8 overflow-hidden bg-bg-primary border-y border-stroke/40">
          <img
            src={paper.hero_image_url}
            alt=""
            className="w-full max-h-[420px] object-contain"
            referrerPolicy="no-referrer"
          />
        </div>
      )}

      {s ? (
        <>
          <Section label="Key claim" body={s.key_claim} />
          <div className="mt-4 bg-bg-primary/60 rounded-xl p-5 font-serif text-[17px] leading-relaxed text-text-primary">
            {s.tldr}
          </div>
          {s.findings?.length > 0 && (
            <div className="mt-5">
              <div className="text-eyebrow font-semibold text-text-secondary uppercase tracking-wider mb-2">
                Findings
              </div>
              <ul className="space-y-2 text-[15px] text-text-primary">
                {s.findings.map((f, i) => (
                  <li key={i}>
                    • {f.statement} <span className="text-text-secondary">— {f.magnitude}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {s.limitations?.length > 0 && (
            <div className="mt-5 bg-warn-bg rounded-xl p-4">
              <div className="text-eyebrow font-semibold text-text-secondary uppercase tracking-wider mb-2">
                Limitations
              </div>
              <ul className="text-[15px] text-text-primary space-y-1.5">
                {s.limitations.map((l, i) => <li key={i}>• {l}</li>)}
              </ul>
            </div>
          )}
        </>
      ) : paper.abstract ? (
        <p className="mt-4 font-serif text-[17px] leading-relaxed text-text-primary">
          {paper.abstract}
        </p>
      ) : (
        <p className="mt-6 text-text-secondary">No summary yet.</p>
      )}

      {/* Action row — three intents: keep saving (pin), drop entirely
          (dismiss), or just unfold the corner (no opinion yet). */}
      <div className="mt-8 grid grid-cols-3 gap-2">
        <button
          onClick={onPin}
          className="rounded-xl bg-jewel-emerald text-white font-semibold py-3 text-sm active:opacity-80"
        >
          ★ Save
        </button>
        <button
          onClick={onUnfold}
          className="rounded-xl bg-bg-primary text-text-primary font-medium py-3 text-sm border border-stroke active:opacity-80"
        >
          Unfold
        </button>
        <button
          onClick={onDismiss}
          className="rounded-xl bg-bg-primary text-text-secondary font-medium py-3 text-sm border border-stroke active:opacity-80"
        >
          Dismiss
        </button>
      </div>
      <div className="mt-3 text-center">
        <Link
          to={`/paper/${paper.id}`}
          className="text-caption text-jewel-emerald font-medium"
        >
          Open full detail →
        </Link>
      </div>
    </article>
  );
}

function Section({ label, body }: { label: string; body: string }) {
  return (
    <div className="mt-5">
      <div className="text-eyebrow font-semibold text-text-secondary uppercase tracking-wider">
        {label}
      </div>
      <p className="mt-1 text-[16px] text-text-primary">{body}</p>
    </div>
  );
}

function ProgressDots({
  count, active, onJump,
}: { count: number; active: number; onJump: (i: number) => void }) {
  if (count > 12) {
    return (
      <div className="text-caption text-text-secondary font-mono">
        {active + 1} / {count}
      </div>
    );
  }
  return (
    <div className="flex gap-1.5">
      {Array.from({ length: count }).map((_, i) => (
        <button
          key={i}
          onClick={() => onJump(i)}
          aria-label={`Go to ${i + 1}`}
          className={`w-2 h-2 rounded-full transition ${
            i === active ? "bg-jewel-topaz scale-125" : "bg-text-secondary/30"
          }`}
        />
      ))}
    </div>
  );
}

function EmptyDeck() {
  return (
    <div className="text-center py-16 px-4">
      <div className="text-5xl mb-4">📖</div>
      <p className="text-text-primary font-semibold mb-2">
        Nothing dog-eared yet
      </p>
      <p className="text-caption text-text-secondary max-w-sm mx-auto">
        Tap the folded-corner control on any feed card to save it for a
        focused read here. Lighter than a long-term ★ Pin — meant for
        "circle back to this in a minute."
      </p>
      <Link
        to="/"
        className="inline-block mt-5 px-4 py-2.5 rounded-xl bg-jewel-emerald text-white text-sm font-semibold"
      >
        Open Feed
      </Link>
    </div>
  );
}
