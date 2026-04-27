import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import type { Paper } from "../lib/types";
import { stripHtml } from "../lib/text";

export default function SearchModal({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Debounced search across the user's papers (RLS scopes to current user).
  useEffect(() => {
    const term = q.trim();
    if (!term) { setResults([]); return; }
    const handle = setTimeout(async () => {
      setLoading(true);
      // Title is the high-signal field; abstract is fallback. We escape `%`
      // and `_` so search terms can't accidentally become wildcards.
      const escaped = term.replace(/[%_]/g, "\\$&");
      const { data } = await supabase
        .from("papers")
        .select("id,title,journal,published_at,authors,doi,relevance_score")
        .or(`title.ilike.%${escaped}%,abstract.ilike.%${escaped}%`)
        .order("relevance_score", { ascending: false })
        .limit(15);
      setResults((data as Paper[]) || []);
      setActiveIdx(0);
      setLoading(false);
    }, 180);
    return () => clearTimeout(handle);
  }, [q]);

  function open(p: Paper) {
    navigate(`/paper/${p.id}`);
    onClose();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") { e.preventDefault(); onClose(); return; }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(results.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter" && results[activeIdx]) {
      e.preventDefault();
      open(results[activeIdx]);
    }
  }

  return (
    <div
      className="fixed inset-0 z-40 bg-text-primary/40 flex items-start justify-center pt-[12vh] px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-bg-card rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-stroke flex items-center gap-2">
          <span className="text-text-secondary">⌕</span>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search your feed and library — title, author, abstract"
            className="flex-1 bg-transparent text-base text-text-primary placeholder:text-text-secondary/60 focus:outline-none"
          />
          <kbd className="text-[10px] font-mono text-text-secondary bg-bg-primary px-1.5 py-0.5 rounded">
            ESC
          </kbd>
        </div>

        <div className="max-h-[60vh] overflow-y-auto">
          {loading && (
            <div className="px-4 py-6 text-caption text-text-secondary">Searching…</div>
          )}
          {!loading && q.trim() && results.length === 0 && (
            <div className="px-4 py-6 text-caption text-text-secondary">No matches.</div>
          )}
          {!loading && results.length > 0 && (
            <ul>
              {results.map((p, i) => (
                <li key={p.id}>
                  <button
                    onClick={() => open(p)}
                    onMouseEnter={() => setActiveIdx(i)}
                    className={`w-full text-left px-4 py-3 border-b border-stroke/60 last:border-b-0 ${
                      i === activeIdx ? "bg-jewel-emerald/10" : ""
                    }`}
                  >
                    <div className="text-eyebrow font-semibold text-text-secondary uppercase tracking-wider line-clamp-1">
                      {p.journal || "Unknown journal"}
                    </div>
                    <div className="text-sm font-semibold text-text-primary leading-snug line-clamp-2 mt-0.5">
                      {stripHtml(p.title)}
                    </div>
                    <div className="text-caption text-text-secondary line-clamp-1 mt-0.5">
                      {(p.authors || [])[0] || ""}
                      {p.authors && p.authors.length > 1 && (
                        <> · et al. ({p.authors.length})</>
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {!q.trim() && (
            <div className="px-4 py-4 text-caption text-text-secondary">
              <div className="font-semibold text-text-primary mb-2">Shortcuts</div>
              <ul className="space-y-1 font-mono text-[12px]">
                <li><kbd className="bg-bg-primary px-1 rounded">⌘K</kbd> open search · <kbd className="bg-bg-primary px-1 rounded">esc</kbd> close</li>
                <li><kbd className="bg-bg-primary px-1 rounded">↑/↓</kbd> navigate · <kbd className="bg-bg-primary px-1 rounded">↵</kbd> open</li>
                <li><kbd className="bg-bg-primary px-1 rounded">j/k</kbd> next/prev card on Feed</li>
                <li><kbd className="bg-bg-primary px-1 rounded">p</kbd> pin focused · <kbd className="bg-bg-primary px-1 rounded">?</kbd> why am I seeing this</li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
