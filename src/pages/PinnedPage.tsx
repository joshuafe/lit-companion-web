import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import type { Paper } from "../lib/types";

interface PinRow {
  paper_id: string;
  pinned_at: string;
  note: string | null;
  papers: Paper | null;
}

interface DismissalRow {
  paper_id: string;
  dismissed_at: string;
  papers: Paper | null;
}

type Tab = "pinned" | "dismissed";

function fmtDate(iso: string): string {
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 14) return `${days}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function stripHtml(s: string | null | undefined): string {
  if (!s) return "";
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export default function PinnedPage() {
  const [tab, setTab] = useState<Tab>("pinned");
  const [pins, setPins] = useState<PinRow[]>([]);
  const [dismissed, setDismissed] = useState<DismissalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    const [{ data: pinData, error: pinErr }, { data: disData, error: disErr }] = await Promise.all([
      supabase
        .from("pins")
        .select("paper_id, pinned_at, note, papers(*)")
        .order("pinned_at", { ascending: false }),
      supabase
        .from("dismissals")
        .select("paper_id, dismissed_at, papers(*)")
        .order("dismissed_at", { ascending: false })
        .limit(50),
    ]);
    if (pinErr) setError(pinErr.message);
    if (disErr) setError(disErr.message);
    setPins(((pinData as unknown) as PinRow[]) || []);
    setDismissed(((disData as unknown) as DismissalRow[]) || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function unpin(paperId: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error: err } = await supabase
      .from("pins")
      .delete()
      .eq("user_id", user.id)
      .eq("paper_id", paperId);
    if (err) {
      setFlash(`Error: ${err.message}`);
    } else {
      setPins((p) => p.filter((r) => r.paper_id !== paperId));
      setFlash("Removed.");
    }
    setTimeout(() => setFlash(null), 1500);
  }

  async function undoDismiss(paperId: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error: err } = await supabase
      .from("dismissals")
      .delete()
      .eq("user_id", user.id)
      .eq("paper_id", paperId);
    if (err) {
      setFlash(`Error: ${err.message}`);
    } else {
      setDismissed((d) => d.filter((r) => r.paper_id !== paperId));
      setFlash("↩ Restored to feed.");
    }
    setTimeout(() => setFlash(null), 1500);
  }

  const showRows = tab === "pinned" ? pins : dismissed;
  const empty =
    !loading &&
    ((tab === "pinned" && pins.length === 0) ||
     (tab === "dismissed" && dismissed.length === 0));

  return (
    <div className="max-w-lg mx-auto px-5 pt-10 pb-32">
      <h1 className="text-[34px] font-semibold text-text-primary leading-tight">Library</h1>
      <p className="text-caption text-text-secondary mt-1">
        Saved papers from the feed and audio briefings.
      </p>

      {/* Tabs */}
      <div className="mt-5 inline-flex bg-bg-card rounded-full p-0.5 text-[12px] font-semibold">
        <button
          onClick={() => setTab("pinned")}
          className={`px-4 py-1.5 rounded-full transition ${
            tab === "pinned" ? "bg-jewel-emerald text-white" : "text-text-secondary"
          }`}
        >
          ★ Saved {pins.length > 0 && <span className="ml-1 opacity-80">{pins.length}</span>}
        </button>
        <button
          onClick={() => setTab("dismissed")}
          className={`px-4 py-1.5 rounded-full transition ${
            tab === "dismissed" ? "bg-jewel-emerald text-white" : "text-text-secondary"
          }`}
        >
          Dismissed {dismissed.length > 0 && <span className="ml-1 opacity-80">{dismissed.length}</span>}
        </button>
      </div>

      {error && <div className="mt-4 text-sm text-red-600">{error}</div>}

      {empty && (
        <div className="mt-10 text-center py-12 px-4">
          <div className="text-4xl mb-3">{tab === "pinned" ? "★" : "↩"}</div>
          <p className="text-text-primary font-medium mb-1">
            {tab === "pinned" ? "Nothing saved yet" : "Nothing dismissed yet"}
          </p>
          <p className="text-caption text-text-secondary">
            {tab === "pinned"
              ? "Long-press any feed card or tap ★ Pin in a paper to save it here."
              : "Dismissed papers from your feed land here. You can restore them any time."}
          </p>
        </div>
      )}

      <ul className="mt-5 space-y-3">
        {showRows.map((r) => {
          const p = r.papers;
          if (!p) return null;
          const when = tab === "pinned"
            ? (r as PinRow).pinned_at
            : (r as DismissalRow).dismissed_at;
          const note = tab === "pinned" ? (r as PinRow).note : null;
          return (
            <li key={p.id}>
              <div className="bg-bg-card rounded-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <span className="text-eyebrow font-semibold text-text-secondary uppercase tracking-wider line-clamp-1">
                    {p.journal || "Unknown journal"}
                    <span className="ml-2 normal-case tracking-normal text-text-secondary/70">
                      · {tab === "pinned" ? "saved" : "dismissed"} {fmtDate(when)}
                    </span>
                  </span>
                </div>
                <Link
                  to={`/paper/${p.id}`}
                  className="block mt-2 text-[16px] font-semibold leading-snug text-text-primary line-clamp-3 active:opacity-70"
                >
                  {stripHtml(p.title)}
                </Link>
                {note && (
                  <div className="mt-2 text-caption text-jewel-emerald italic">
                    "{note}"
                  </div>
                )}
                {p.summary?.tldr && (
                  <p className="mt-2 text-caption text-text-secondary line-clamp-2">
                    {stripHtml(p.summary.tldr)}
                  </p>
                )}
                <div className="mt-3 flex items-center justify-between text-caption text-text-secondary">
                  <span className="truncate">
                    {p.authors?.[p.authors.length - 1] ?? p.authors?.[0] ?? ""}
                  </span>
                  {tab === "pinned" ? (
                    <button
                      onClick={() => unpin(p.id)}
                      className="text-text-secondary hover:text-red-600 text-xs font-medium shrink-0"
                    >
                      Remove
                    </button>
                  ) : (
                    <button
                      onClick={() => undoDismiss(p.id)}
                      className="text-jewel-emerald font-medium text-xs shrink-0"
                    >
                      ↩ Restore
                    </button>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

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
