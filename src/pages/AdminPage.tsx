import { useEffect, useMemo, useState } from "react";
import { supabase, SUPABASE_URL } from "../lib/supabase";

interface Row {
  user_id: string;
  email: string | null;
  created_at: string | null;
  last_sign_in: string | null;
  interest_text: string | null;
  calibrated_at: string | null;
  journal_count: number;
  seed_count: number;
  pending_seeds: number;
  paper_count: number;
  avg_relevance: number | null;
  pins: number;
  dismissals: number;
  latest_briefing_date: string | null;
  latest_briefing_has_audio: boolean;
  latest_briefing_paper_count: number;
  latest_briefing_transcript: string | null;
}

type SortKey =
  | "email"
  | "last_sign_in"
  | "paper_count"
  | "pins"
  | "pending_seeds"
  | "avg_relevance";

export default function AdminPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("last_sign_in");
  const [sortDesc, setSortDesc] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setError("Not signed in.");
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-overview`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) {
        const body = await res.text();
        setError(`${res.status}: ${body}`);
        setLoading(false);
        return;
      }
      const data = await res.json();
      setRows(data.rows || []);
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const sorted = useMemo(() => {
    const r = [...rows];
    r.sort((a, b) => {
      const va = (a as any)[sortKey];
      const vb = (b as any)[sortKey];
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === "number" && typeof vb === "number") return sortDesc ? vb - va : va - vb;
      return sortDesc
        ? String(vb).localeCompare(String(va))
        : String(va).localeCompare(String(vb));
    });
    return r;
  }, [rows, sortKey, sortDesc]);

  function toggleSort(k: SortKey) {
    if (k === sortKey) setSortDesc(!sortDesc);
    else {
      setSortKey(k);
      setSortDesc(true);
    }
  }

  function fmtDate(s: string | null) {
    if (!s) return "—";
    return new Date(s).toLocaleDateString("en-US", {
      month: "short", day: "numeric",
    });
  }

  function fmtScore(s: number | null) {
    if (s == null) return "—";
    return `${Math.round(s * 100)}`;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 pt-10 pb-16">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-[28px] font-semibold text-text-primary">Admin</h1>
        <button
          onClick={load}
          disabled={loading}
          className="text-sm text-accent font-medium disabled:opacity-50"
        >
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="mb-4 text-sm text-red-600 bg-red-50 rounded-xl p-3 break-all">
          {error}
        </div>
      )}

      {!loading && !error && rows.length === 0 && (
        <div className="text-caption text-text-secondary">No users yet.</div>
      )}

      {rows.length > 0 && (
        <div className="bg-bg-card rounded-2xl overflow-hidden">
          <div className="grid grid-cols-[1.8fr_0.8fr_0.8fr_0.8fr_0.8fr_0.8fr] gap-2 px-3 py-2 text-[11px] uppercase tracking-wider font-semibold text-text-secondary border-b border-stroke">
            <button onClick={() => toggleSort("email")} className="text-left">User</button>
            <button onClick={() => toggleSort("last_sign_in")} className="text-left">Last seen</button>
            <button onClick={() => toggleSort("paper_count")} className="text-left">Papers</button>
            <button onClick={() => toggleSort("avg_relevance")} className="text-left">Avg %</button>
            <button onClick={() => toggleSort("pins")} className="text-left">★ / ✕</button>
            <button onClick={() => toggleSort("pending_seeds")} className="text-left">Seeds</button>
          </div>

          <ul className="divide-y divide-stroke">
            {sorted.map((r) => {
              const isOpen = expanded === r.user_id;
              return (
                <li key={r.user_id}>
                  <button
                    onClick={() => setExpanded(isOpen ? null : r.user_id)}
                    className="w-full grid grid-cols-[1.8fr_0.8fr_0.8fr_0.8fr_0.8fr_0.8fr] gap-2 px-3 py-3 items-center text-left active:bg-bg-primary/50"
                  >
                    <div className="min-w-0">
                      <div className="text-sm text-text-primary truncate">
                        {r.email || "(no email)"}
                      </div>
                      <div className="text-[11px] text-text-secondary truncate">
                        {r.user_id.slice(0, 8)}
                      </div>
                    </div>
                    <div className="text-sm text-text-primary">{fmtDate(r.last_sign_in)}</div>
                    <div className="text-sm text-text-primary">{r.paper_count}</div>
                    <div className="text-sm text-text-primary">{fmtScore(r.avg_relevance)}</div>
                    <div className="text-sm text-text-primary">
                      {r.pins} / {r.dismissals}
                    </div>
                    <div className="text-sm text-text-primary">
                      {r.seed_count}
                      {r.pending_seeds > 0 && (
                        <span className="ml-1 text-accent">·{r.pending_seeds}</span>
                      )}
                    </div>
                  </button>

                  {isOpen && (
                    <div className="px-4 py-3 bg-bg-primary/50 space-y-2 text-caption">
                      <DetailRow k="Interest" v={r.interest_text || "—"} />
                      <DetailRow k="Preferred journals" v={String(r.journal_count)} />
                      <DetailRow
                        k="Calibrated"
                        v={r.calibrated_at ? fmtDate(r.calibrated_at) : "never"}
                      />
                      <DetailRow
                        k="Latest briefing"
                        v={
                          r.latest_briefing_date
                            ? `${fmtDate(r.latest_briefing_date)} · ${r.latest_briefing_paper_count} papers${r.latest_briefing_has_audio ? " · audio ✓" : ""}`
                            : "—"
                        }
                      />
                      {r.latest_briefing_transcript && (
                        <DetailRow
                          k="Transcript"
                          v={r.latest_briefing_transcript + "…"}
                        />
                      )}
                      <DetailRow
                        k="Signed up"
                        v={r.created_at ? fmtDate(r.created_at) : "—"}
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

function DetailRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex gap-3">
      <span className="text-text-secondary shrink-0 w-32">{k}</span>
      <span className="text-text-primary flex-1 break-words">{v}</span>
    </div>
  );
}
