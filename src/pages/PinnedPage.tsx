import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import type { Paper } from "../lib/types";
import SwipeRow from "../components/SwipeRow";
import { parseTitleType } from "../lib/text";

// BibTeX cite-key from first-author last name + year + first significant word.
// Build display groups based on the user's chosen axis.
// - "date": one group per relative day (today / yesterday / 3d ago / etc.)
// - "tag":  one group per tag from summary.tags_suggested. Papers with
//          multiple tags appear in each tag's group; untagged papers
//          land in "Untagged".
// - "journal": one group per paper.journal.
function groupRows(
  rows: (PinRow | DismissalRow)[],
  groupBy: "date" | "tag" | "journal",
  tab: "pinned" | "dismissed",
): { heading: string; rows: (PinRow | DismissalRow)[] }[] {
  if (rows.length === 0) return [];
  const tsOf = (r: PinRow | DismissalRow) =>
    tab === "pinned" ? (r as PinRow).pinned_at : (r as DismissalRow).dismissed_at;

  if (groupBy === "date") {
    // rows are already sorted desc by ts; bucket by day label.
    const out: { heading: string; rows: (PinRow | DismissalRow)[] }[] = [];
    let current: string | null = null;
    for (const r of rows) {
      const t = tsOf(r);
      if (!t) continue;
      const label = relativeDayLabel(t);
      if (label !== current) {
        current = label;
        out.push({ heading: label, rows: [] });
      }
      out[out.length - 1].rows.push(r);
    }
    return out;
  }

  if (groupBy === "journal") {
    const m = new Map<string, (PinRow | DismissalRow)[]>();
    for (const r of rows) {
      const j = r.papers?.journal || "Unknown journal";
      if (!m.has(j)) m.set(j, []);
      m.get(j)!.push(r);
    }
    return Array.from(m.entries())
      .sort((a, b) => b[1].length - a[1].length)
      .map(([heading, rs]) => ({ heading, rows: rs }));
  }

  // tag — pull from BOTH user-authored pin tags (lowercased) and the
  // LLM-suggested topical tags on the paper. User tags float to the top
  // because they reflect explicit intent ("to read", "grant prep") that
  // the topical tags don't.
  const userTagBuckets = new Map<string, (PinRow | DismissalRow)[]>();
  const aiTagBuckets = new Map<string, (PinRow | DismissalRow)[]>();
  const untagged: (PinRow | DismissalRow)[] = [];
  for (const r of rows) {
    const userTags = ((r as PinRow).tags || []).filter(Boolean);
    const aiTags = (r.papers?.summary?.tags_suggested || []).filter(Boolean);
    if (userTags.length === 0 && aiTags.length === 0) {
      untagged.push(r);
      continue;
    }
    for (const t of userTags) {
      const key = t.toLowerCase();
      if (!userTagBuckets.has(key)) userTagBuckets.set(key, []);
      userTagBuckets.get(key)!.push(r);
    }
    for (const t of aiTags) {
      const key = t.toLowerCase();
      if (!aiTagBuckets.has(key)) aiTagBuckets.set(key, []);
      aiTagBuckets.get(key)!.push(r);
    }
  }
  const userGroups = Array.from(userTagBuckets.entries())
    .sort((a, b) => b[1].length - a[1].length)
    .map(([t, rs]) => ({ heading: `# ${t}`, rows: rs }));
  const aiGroups = Array.from(aiTagBuckets.entries())
    .sort((a, b) => b[1].length - a[1].length)
    .map(([t, rs]) => ({ heading: t, rows: rs }));
  const groups = [...userGroups, ...aiGroups];
  if (untagged.length > 0) groups.push({ heading: "Untagged", rows: untagged });
  return groups;
}

function relativeDayLabel(iso: string): string {
  const d = new Date(iso); d.setHours(0, 0, 0, 0);
  const t = new Date(); t.setHours(0, 0, 0, 0);
  const days = Math.round((t.getTime() - d.getTime()) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 14) return "Last week";
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 365) return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  return d.toLocaleDateString("en-US", { year: "numeric" });
}

function bibKey(p: Paper): string {
  const first = (p.authors?.[0] || "anon").split(/[\s,]+/)[0].toLowerCase();
  const year = p.published_at ? new Date(p.published_at).getFullYear() : "nd";
  const stop = new Set(["the", "a", "an", "of", "and", "in", "on", "for", "with", "to"]);
  const word = (p.title || "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .find((w) => w.length >= 3 && !stop.has(w)) || "paper";
  return `${first}${year}${word}`.replace(/[^a-z0-9]/g, "");
}

function bibEscape(s: string | null | undefined): string {
  if (!s) return "";
  return s.replace(/[{}\\]/g, "").replace(/&/g, "\\&").trim();
}

function paperToBibtex(p: Paper): string {
  const key = bibKey(p);
  const isPreprint =
    !!p.doi?.toLowerCase().match(/biorxiv|medrxiv/) ||
    !!p.journal?.toLowerCase().match(/biorxiv|medrxiv|preprint/);
  const kind = isPreprint ? "@unpublished" : "@article";
  const fields: [string, string | null | undefined][] = [
    ["title", p.title],
    ["author", (p.authors || []).map(bibEscape).join(" and ")],
    ["journal", p.journal],
    ["year", p.published_at ? String(new Date(p.published_at).getFullYear()) : null],
    ["doi", p.doi],
    ["url", p.url],
    ["note", isPreprint ? "Preprint" : null],
  ];
  const body = fields
    .filter(([, v]) => v != null && v !== "")
    .map(([k, v]) => `  ${k} = {${bibEscape(v as string)}}`)
    .join(",\n");
  return `${kind}{${key},\n${body}\n}`;
}

function downloadText(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

interface PinRow {
  paper_id: string;
  pinned_at: string;
  note: string | null;
  tags: string[] | null;
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
  const [groupBy, setGroupBy] = useState<"date" | "tag" | "journal">("date");
  const navigate = useNavigate();

  async function load() {
    setLoading(true);
    setError(null);
    const [{ data: pinData, error: pinErr }, { data: disData, error: disErr }] = await Promise.all([
      supabase
        .from("pins")
        .select("paper_id, pinned_at, note, tags, papers(*)")
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

  function exportBibtex() {
    const papers = pins.map((r) => r.papers).filter((p): p is Paper => !!p);
    if (papers.length === 0) {
      setFlash("Nothing to export.");
      setTimeout(() => setFlash(null), 1500);
      return;
    }
    const stamp = new Date().toISOString().slice(0, 10);
    const header = `% Literature Companion — Pinned papers, exported ${stamp}\n% ${papers.length} entries\n\n`;
    const body = papers.map(paperToBibtex).join("\n\n");
    downloadText(`literature-companion-pins-${stamp}.bib`, header + body);
    setFlash(`✓ Exported ${papers.length} entries`);
    setTimeout(() => setFlash(null), 1800);
  }

  const showRows = tab === "pinned" ? pins : dismissed;
  const empty =
    !loading &&
    ((tab === "pinned" && pins.length === 0) ||
     (tab === "dismissed" && dismissed.length === 0));

  return (
    <div className="max-w-lg lg:max-w-4xl mx-auto px-5 lg:px-10 pt-10 pb-32">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-[34px] font-semibold text-text-primary leading-tight">Library</h1>
          <p className="text-caption text-text-secondary mt-1">
            Saved papers from the feed and audio briefings.
          </p>
        </div>
        <Link
          to="/library/add"
          className="shrink-0 mt-2 px-4 py-2 rounded-full bg-jewel-emerald text-white text-sm font-semibold active:opacity-80"
          title="Upload a PDF you found elsewhere"
        >
          + Add
        </Link>
      </div>

      {/* Tabs + export */}
      <div className="mt-5 flex items-center justify-between gap-3 flex-wrap">
        <div className="inline-flex bg-bg-card rounded-full p-0.5 text-[12px] font-semibold">
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
              tab === "dismissed" ? "bg-jewel-ruby text-white" : "text-text-secondary"
            }`}
          >
            Dismissed {dismissed.length > 0 && <span className="ml-1 opacity-80">{dismissed.length}</span>}
          </button>
        </div>
        {tab === "pinned" && pins.length > 0 && (
          <button
            onClick={exportBibtex}
            className="text-[11px] font-semibold text-jewel-emerald uppercase tracking-wider px-3 py-1.5 rounded-full border border-jewel-emerald/30 hover:bg-jewel-emerald/5"
            title="Download all pinned papers as a .bib file"
          >
            ⬇ BibTeX
          </button>
        )}
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

      {/* Group-by toggle */}
      {!empty && (
        <div className="mt-4 flex items-center gap-1.5 text-[11px] font-semibold">
          <span className="text-text-secondary uppercase tracking-wider mr-1">Group:</span>
          {(["date", "tag", "journal"] as const).map((g) => (
            <button
              key={g}
              onClick={() => setGroupBy(g)}
              className={`px-2.5 py-1 rounded-full transition ${
                groupBy === g
                  ? "bg-jewel-emerald/15 text-jewel-emerald"
                  : "bg-bg-card text-text-secondary border border-stroke"
              }`}
            >
              {g === "date" ? "Date" : g === "tag" ? "Tag" : "Journal"}
            </button>
          ))}
          <span className="ml-auto text-text-secondary/60 font-normal text-[10px]">
            Swipe left to remove
          </span>
        </div>
      )}

      <div className="mt-5 space-y-6">
        {groupRows(showRows, groupBy, tab).map(({ heading, rows }) => (
          <section key={heading}>
            <div className="text-eyebrow font-semibold text-text-secondary uppercase tracking-wider mb-2">
              {heading}{" "}
              <span className="text-text-secondary/60 font-normal">· {rows.length}</span>
            </div>
            <ul className="space-y-2 lg:space-y-0 lg:columns-2 lg:gap-2 [&>li]:lg:break-inside-avoid [&>li]:lg:mb-2">
              {rows.map((r) => {
                const p = r.papers!;
                const when = tab === "pinned"
                  ? (r as PinRow).pinned_at
                  : (r as DismissalRow).dismissed_at;
                const note = tab === "pinned" ? (r as PinRow).note : null;
                return (
                  <li key={`${heading}-${p.id}`}>
                    <SwipeRow
                      onTap={() => navigate(`/paper/${p.id}`)}
                      swipeLeft={
                        tab === "pinned"
                          ? { label: "Remove", bg: "bg-red-500", onCommit: () => unpin(p.id) }
                          : { label: "↩ Restore", bg: "bg-jewel-emerald", onCommit: () => undoDismiss(p.id) }
                      }
                    >
                      <div className="bg-bg-card p-3 cursor-pointer select-none">
                        <div className="flex items-start justify-between gap-3">
                          <span className="text-eyebrow font-semibold text-text-secondary uppercase tracking-wider line-clamp-1">
                            {p.journal || "Unknown journal"}
                            <span className="ml-2 normal-case tracking-normal text-text-secondary/70">
                              · {tab === "pinned" ? "saved" : "dismissed"} {fmtDate(when)}
                            </span>
                          </span>
                        </div>
                        <div className="mt-1.5 font-serif text-[15px] font-semibold leading-snug text-text-primary line-clamp-2">
                          {stripHtml(parseTitleType(p.title).display)}
                        </div>
                        {note && (
                          <div className="mt-1 text-caption text-jewel-emerald italic line-clamp-2 font-serif">
                            {note}
                          </div>
                        )}
                        {tab === "pinned" && (r as PinRow).tags && (r as PinRow).tags!.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {(r as PinRow).tags!.slice(0, 4).map((t) => (
                              <span
                                key={t}
                                className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-jewel-emerald/15 text-jewel-emerald"
                              >
                                #{t}
                              </span>
                            ))}
                          </div>
                        )}
                        {p.summary?.tldr && !note && (
                          <p className="mt-1 text-caption text-text-secondary line-clamp-2">
                            {stripHtml(p.summary.tldr)}
                          </p>
                        )}
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
