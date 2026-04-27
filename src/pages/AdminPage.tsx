import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase, SUPABASE_URL } from "../lib/supabase";

interface Row {
  user_id: string;
  email: string | null;
  created_at: string | null;
  last_sign_in: string | null;
  interest_text: string | null;
  calibrated_at: string | null;
  orcid_id: string | null;
  proxy_configured: boolean;
  journal_count: number;
  seed_count: number;
  pending_seeds: number;
  paper_count: number;
  avg_relevance: number | null;
  pins: number;
  dismissals: number;
  briefing_count: number;
  // pipeline health
  pipeline_running: boolean;
  pipeline_running_since: string | null;
  runs_last_7d: number;
  papers_today: number;
  papers_yesterday: number;
  papers_7d: number;
  papers_with_real_image: number;
  papers_with_generated_image: number;
  // latest briefing
  latest_briefing_date: string | null;
  latest_briefing_has_audio: boolean;
  latest_briefing_paper_count: number;
  latest_briefing_image_count: number;
  latest_briefing_duration_s: number | null;
  latest_briefing_block_count: number;
  latest_briefing_transcript: string | null;
  last_action: string | null;
  days_since_action: number | null;
  days_since_signup: number | null;
  active_days_30d: number;
  action_rate: number;
}

interface AuthorRank { name: string; user_count: number; }
interface JournalRank { name: string; pins: number; user_count: number; }
interface WaitlistEntry {
  id: string;
  email: string;
  created_at: string;
  source: string;
  notes: string | null;
  invited_at: string | null;
}
interface MetricSample {
  ts: number;
  cpu: number;
  mem: number;
  mem_gb: number | null;
  ollama_pct: number;
  pipeline_users: number;
}

interface Summary {
  total_users: number;
  active_7d: number;
  active_30d: number;
  onboarded: number;
  total_papers: number;
  total_pins: number;
  total_dismissals: number;
  total_briefings: number;
  total_papers_with_real_image: number;
  total_papers_with_generated_image: number;
  total_papers_today: number;
  total_papers_7d: number;
  pipelines_running_now: number;
}

type SortKey =
  | "email"
  | "last_action"
  | "active_days_30d"
  | "paper_count"
  | "pins"
  | "action_rate"
  | "pending_seeds"
  | "avg_relevance";

export default function AdminPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [topAuthors, setTopAuthors] = useState<AuthorRank[]>([]);
  const [topJournals, setTopJournals] = useState<JournalRank[]>([]);
  const [metrics, setMetrics] = useState<MetricSample[]>([]);
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("last_action");
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
      setSummary(data.summary || null);
      setTopAuthors(data.top_authors || []);
      setTopJournals(data.top_journals || []);
      setMetrics(data.metrics || []);
      setWaitlist(data.waitlist || []);
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
    else { setSortKey(k); setSortDesc(true); }
  }

  function fmtDate(s: string | null) {
    if (!s) return "—";
    return new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  function fmtScore(s: number | null) { return s == null ? "—" : `${Math.round(s * 100)}`; }
  function fmtRate(r: number) { return `${Math.round(r * 100)}%`; }
  function fmtAgo(d: number | null) {
    if (d == null) return "—";
    if (d === 0) return "today";
    if (d === 1) return "1d";
    if (d < 30) return `${d}d`;
    if (d < 365) return `${Math.floor(d / 30)}mo`;
    return `${Math.floor(d / 365)}y`;
  }

  return (
    <div className="max-w-5xl mx-auto px-4 pt-10 pb-16">
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

      {summary && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
            <Stat label="Users" value={summary.total_users} />
            <Stat label="Active 7d" value={summary.active_7d} sub={`${summary.active_30d} / 30d`} />
            <Stat label="Onboarded" value={summary.onboarded} sub={`of ${summary.total_users}`} />
            <Stat label="Briefings" value={summary.total_briefings} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
            <Stat label="Papers today" value={summary.total_papers_today} sub={`${summary.total_papers_7d} / 7d`} />
            <Stat label="Total papers" value={summary.total_papers} />
            <Stat label="Pins / Dismissals" value={`${summary.total_pins} / ${summary.total_dismissals}`} />
            <Stat
              label="Action rate"
              value={
                summary.total_papers
                  ? fmtRate((summary.total_pins + summary.total_dismissals) / summary.total_papers)
                  : "—"
              }
            />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-4">
            <Stat
              label="Real images"
              value={summary.total_papers_with_real_image}
              sub={`${summary.total_papers_with_generated_image} generated`}
            />
            <Stat
              label="Image rate"
              value={
                (summary.total_papers_with_real_image + summary.total_papers_with_generated_image) > 0
                  ? fmtRate(summary.total_papers_with_real_image /
                            (summary.total_papers_with_real_image + summary.total_papers_with_generated_image))
                  : "—"
              }
              sub="real ÷ total"
            />
            <Stat
              label="Pipelines running"
              value={summary.pipelines_running_now}
              sub={summary.pipelines_running_now > 0 ? "live now" : "idle"}
            />
          </div>
        </>
      )}

      {waitlist.length > 0 && (
        <div className="bg-bg-card rounded-2xl p-4 mb-3 border border-jewel-topaz/20">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-eyebrow font-semibold text-jewel-topaz uppercase tracking-wider">
                Token waitlist
              </div>
              <div className="text-caption text-text-secondary/70 mt-0.5">
                {waitlist.filter((w) => !w.invited_at).length} pending ·{" "}
                {waitlist.filter((w) => w.invited_at).length} already invited ·
                ordered oldest first
              </div>
            </div>
          </div>
          <ol className="space-y-1.5">
            {waitlist.map((w, i) => (
              <li
                key={w.id}
                className={`flex items-start gap-3 text-sm py-1.5 ${
                  w.invited_at ? "opacity-50" : ""
                }`}
              >
                <span className="font-mono text-text-secondary/60 w-6 shrink-0 text-right">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-text-primary font-medium truncate">
                      {w.email}
                    </span>
                    {w.invited_at && (
                      <span className="text-[10px] text-jewel-emerald font-semibold uppercase tracking-wider shrink-0">
                        ✓ invited
                      </span>
                    )}
                    <span className="text-[10px] text-text-secondary/60 font-mono ml-auto shrink-0">
                      {new Date(w.created_at).toLocaleDateString("en-US", {
                        month: "short", day: "numeric",
                      })}
                    </span>
                  </div>
                  {w.notes && (
                    <div className="mt-0.5 text-caption text-text-secondary line-clamp-2 font-serif">
                      {w.notes}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      {metrics.length > 0 && (
        <div className="bg-bg-card rounded-2xl p-4 mb-3">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-eyebrow font-semibold text-text-secondary uppercase tracking-wider">
                Ollama footprint · last 24h
              </div>
              <div className="text-caption text-text-secondary/70 mt-0.5">
                CPU + memory consumed by Ollama on the Mac — when it's loaded, how hard, how often.
              </div>
            </div>
            <MetricsCurrent metrics={metrics} />
          </div>
          <MetricsChart metrics={metrics} />
        </div>
      )}

      {(topAuthors.length > 0 || topJournals.length > 0) && (
        <div className="grid md:grid-cols-2 gap-3 mb-4">
          {topAuthors.length > 0 && (
            <div className="bg-bg-card rounded-2xl p-4">
              <div className="text-eyebrow font-semibold text-text-secondary uppercase tracking-wider mb-2">
                Most-followed authors
              </div>
              <ul className="space-y-1.5">
                {topAuthors.map((a) => (
                  <li key={a.name} className="flex items-center justify-between text-sm">
                    <span className="text-text-primary truncate">{a.name}</span>
                    <span className="text-jewel-emerald font-semibold ml-2 shrink-0">
                      {a.user_count}
                      <span className="text-text-secondary/70 font-normal ml-0.5">
                        {a.user_count === 1 ? "user" : "users"}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {topJournals.length > 0 && (
            <div className="bg-bg-card rounded-2xl p-4">
              <div className="text-eyebrow font-semibold text-text-secondary uppercase tracking-wider mb-2">
                Most-pinned journals
              </div>
              <ul className="space-y-1.5">
                {topJournals.map((j) => (
                  <li key={j.name} className="flex items-center justify-between text-sm">
                    <span className="text-text-primary truncate">{j.name}</span>
                    <span className="text-jewel-topaz font-semibold ml-2 shrink-0">
                      {j.pins}
                      <span className="text-text-secondary/70 font-normal ml-0.5">
                        pins · {j.user_count}u
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {!loading && !error && rows.length === 0 && (
        <div className="text-caption text-text-secondary">No users yet.</div>
      )}

      {rows.length > 0 && (
        <div className="bg-bg-card rounded-2xl overflow-hidden">
          <div className="grid grid-cols-[1.6fr_0.7fr_0.7fr_0.7fr_0.7fr_0.7fr_0.7fr] gap-2 px-3 py-2 text-[11px] uppercase tracking-wider font-semibold text-text-secondary border-b border-stroke">
            <HeaderBtn label="User" k="email" sortKey={sortKey} desc={sortDesc} onClick={toggleSort} />
            <HeaderBtn label="Last act." k="last_action" sortKey={sortKey} desc={sortDesc} onClick={toggleSort} />
            <HeaderBtn label="Active/30" k="active_days_30d" sortKey={sortKey} desc={sortDesc} onClick={toggleSort} />
            <HeaderBtn label="Papers" k="paper_count" sortKey={sortKey} desc={sortDesc} onClick={toggleSort} />
            <HeaderBtn label="Avg %" k="avg_relevance" sortKey={sortKey} desc={sortDesc} onClick={toggleSort} />
            <HeaderBtn label="★/✕ · rate" k="action_rate" sortKey={sortKey} desc={sortDesc} onClick={toggleSort} />
            <HeaderBtn label="Seeds" k="pending_seeds" sortKey={sortKey} desc={sortDesc} onClick={toggleSort} />
          </div>

          <ul className="divide-y divide-stroke">
            {sorted.map((r) => {
              const isOpen = expanded === r.user_id;
              return (
                <li key={r.user_id}>
                  <button
                    onClick={() => setExpanded(isOpen ? null : r.user_id)}
                    className="w-full grid grid-cols-[1.6fr_0.7fr_0.7fr_0.7fr_0.7fr_0.7fr_0.7fr] gap-2 px-3 py-3 items-center text-left active:bg-bg-primary/50"
                  >
                    <div className="min-w-0">
                      <div className="text-sm text-text-primary truncate">
                        {r.email || "(no email)"}
                      </div>
                      <div className="text-[11px] text-text-secondary truncate">
                        {r.user_id.slice(0, 8)} · {r.days_since_signup != null ? `${r.days_since_signup}d old` : ""}
                      </div>
                    </div>
                    <div className="text-sm">
                      <span className={
                        r.days_since_action != null && r.days_since_action <= 7
                          ? "text-relevance-high"
                          : r.days_since_action != null && r.days_since_action <= 30
                          ? "text-text-primary"
                          : "text-text-secondary"
                      }>
                        {fmtAgo(r.days_since_action)}
                      </span>
                    </div>
                    <div className="text-sm text-text-primary">
                      {r.active_days_30d}
                    </div>
                    <div className="text-sm text-text-primary">{r.paper_count}</div>
                    <div className="text-sm text-text-primary">{fmtScore(r.avg_relevance)}</div>
                    <div className="text-sm text-text-primary">
                      {r.pins}/{r.dismissals}
                      <span className="text-[11px] text-text-secondary ml-1">
                        {fmtRate(r.action_rate)}
                      </span>
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
                      <DetailRow k="ORCID iD" v={r.orcid_id || "—"} />
                      <DetailRow k="Proxy configured" v={r.proxy_configured ? "✓" : "—"} />
                      <DetailRow k="Preferred journals" v={String(r.journal_count)} />
                      <DetailRow k="Calibrated" v={r.calibrated_at ? fmtDate(r.calibrated_at) : "never"} />
                      <DetailRow k="Pipeline status" v={r.pipeline_running ? `running since ${fmtDate(r.pipeline_running_since!)}` : "idle"} />
                      <DetailRow k="Runs last 7d" v={String(r.runs_last_7d)} />
                      <DetailRow k="Papers today / yesterday / 7d" v={`${r.papers_today} / ${r.papers_yesterday} / ${r.papers_7d}`} />
                      <DetailRow k="Image source" v={`${r.papers_with_real_image} real · ${r.papers_with_generated_image} generated`} />
                      <DetailRow k="Briefings delivered" v={String(r.briefing_count)} />
                      <DetailRow
                        k="Latest briefing"
                        v={
                          r.latest_briefing_date
                            ? `${fmtDate(r.latest_briefing_date)} · ${r.latest_briefing_block_count}/${r.latest_briefing_paper_count} blocks${r.latest_briefing_duration_s ? ` · ${Math.round(r.latest_briefing_duration_s)}s` : ""}${r.latest_briefing_has_audio ? " · audio ✓" : ""} · ${r.latest_briefing_image_count} images`
                            : "—"
                        }
                      />
                      {r.latest_briefing_transcript && (
                        <DetailRow k="Transcript" v={r.latest_briefing_transcript + "…"} />
                      )}
                      <DetailRow k="Signed up" v={r.created_at ? fmtDate(r.created_at) : "—"} />
                      <DetailRow k="Last sign-in" v={r.last_sign_in ? fmtDate(r.last_sign_in) : "—"} />
                      <div className="pt-1">
                        <Link
                          to={`/admin/${r.user_id}`}
                          className="text-accent font-medium"
                        >
                          Open detail →
                        </Link>
                      </div>
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

// Pipeline-only resource usage chart.
// Renders two stacked area lines (CPU%, mem%) over a 24h window using
// inline SVG. cpu_percent can exceed 100 because we sum across cores
// — we soft-clamp to a per-window maximum so spikes don't compress
// the rest of the curve into invisibility.
function MetricsChart({ metrics }: { metrics: MetricSample[] }) {
  const W = 720, H = 140, pad = { l: 28, r: 8, t: 6, b: 18 };
  const innerW = W - pad.l - pad.r;
  const innerH = H - pad.t - pad.b;
  if (metrics.length < 2) {
    return (
      <div className="text-caption text-text-secondary/70 text-center py-8">
        Need a few more samples — first chart appears after ~5 minutes.
      </div>
    );
  }
  const tMin = metrics[0].ts;
  const tMax = metrics[metrics.length - 1].ts;
  const xRange = Math.max(1, tMax - tMin);
  const cpuMax = Math.max(20, ...metrics.map((m) => m.cpu)) * 1.1;
  const memMax = Math.max(5, ...metrics.map((m) => m.mem)) * 1.2;
  const x = (ts: number) => pad.l + ((ts - tMin) / xRange) * innerW;
  const yCpu = (v: number) => pad.t + innerH - (Math.min(v, cpuMax) / cpuMax) * innerH;
  const yMem = (v: number) => pad.t + innerH - (Math.min(v, memMax) / memMax) * innerH;

  const cpuPath = metrics.map((m, i) =>
    `${i === 0 ? "M" : "L"}${x(m.ts).toFixed(1)},${yCpu(m.cpu).toFixed(1)}`,
  ).join(" ");
  const memPath = metrics.map((m, i) =>
    `${i === 0 ? "M" : "L"}${x(m.ts).toFixed(1)},${yMem(m.mem).toFixed(1)}`,
  ).join(" ");
  // Hour markers across the 24h window — every 2h with a label, every
  // 1h with just a tick mark for visual rhythm. Day-changes get a date
  // label so a chart spanning midnight reads as such.
  interface Tick { x: number; label: string; major: boolean; isDayChange: boolean; }
  const ticks: Tick[] = [];
  const startDate = new Date(tMin);
  startDate.setMinutes(0, 0, 0);
  let prevDay = "";
  for (let h = 0; h <= 25; h += 1) {
    const t = startDate.getTime() + h * 3600 * 1000;
    if (t < tMin || t > tMax) continue;
    const d = new Date(t);
    const dayKey = d.toDateString();
    const isDayChange = dayKey !== prevDay && prevDay !== "";
    prevDay = dayKey;
    const major = (d.getHours() % 2 === 0) || isDayChange;
    let label = "";
    if (isDayChange) {
      label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    } else if (major) {
      label = d.toLocaleTimeString("en-US", { hour: "numeric", hour12: true });
    }
    ticks.push({ x: x(t), label, major, isDayChange });
  }
  // "Now" cursor — a vertical guide at right edge so user sees how
  // recent the chart actually is.
  const nowX = x(Math.min(Date.now(), tMax));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto block">
      {/* horizontal grid lines */}
      {[0.25, 0.5, 0.75].map((p) => (
        <line
          key={p}
          x1={pad.l} x2={W - pad.r}
          y1={pad.t + innerH * p} y2={pad.t + innerH * p}
          stroke="#2E2A24" strokeOpacity={0.06}
        />
      ))}
      {/* CPU shaded area */}
      <path
        d={`${cpuPath} L${x(tMax).toFixed(1)},${pad.t + innerH} L${x(tMin).toFixed(1)},${pad.t + innerH} Z`}
        fill="#3F6E55" fillOpacity={0.18}
      />
      <path d={cpuPath} fill="none" stroke="#3F6E55" strokeWidth={1.6} />
      {/* Memory line (different scale, thinner so it reads as an overlay) */}
      <path d={memPath} fill="none" stroke="#A8853A" strokeWidth={1.4} strokeDasharray="3 2" />
      {/* X-axis tick marks — minor every hour, major every 2h with label */}
      {ticks.map((t, i) => (
        <g key={i}>
          <line
            x1={t.x} x2={t.x}
            y1={pad.t + innerH} y2={pad.t + innerH + (t.major ? 5 : 2.5)}
            stroke="#2E2A24"
            strokeOpacity={t.isDayChange ? 0.4 : t.major ? 0.25 : 0.12}
          />
          {t.label && (
            <text
              x={t.x} y={H - 4}
              textAnchor="middle"
              fontSize={t.isDayChange ? 8.5 : 8}
              fill="#2E2A24"
              fillOpacity={t.isDayChange ? 0.7 : 0.55}
              fontWeight={t.isDayChange ? 600 : 400}
            >
              {t.label}
            </text>
          )}
        </g>
      ))}
      {/* "Now" indicator — dotted vertical line + tiny dot */}
      {nowX >= pad.l && (
        <g>
          <line
            x1={nowX} x2={nowX}
            y1={pad.t} y2={pad.t + innerH}
            stroke="#3F6E55" strokeOpacity={0.35} strokeWidth={1} strokeDasharray="2 3"
          />
          <circle cx={nowX} cy={pad.t} r={2} fill="#3F6E55" />
        </g>
      )}
      {/* Y-axis labels — CPU on the left */}
      <text x={pad.l - 4} y={pad.t + 4} textAnchor="end" fontSize="9" fill="#3F6E55">
        {Math.round(cpuMax)}%
      </text>
      <text x={pad.l - 4} y={pad.t + innerH} textAnchor="end" fontSize="9" fill="#3F6E55">0</text>
      {/* legend */}
      <g transform={`translate(${pad.l + 4} ${pad.t + 4})`}>
        <rect width="9" height="3" y="2" fill="#3F6E55" />
        <text x="13" y="6" fontSize="9" fill="#2E2A24">CPU%</text>
        <line x1="48" y1="3.5" x2="58" y2="3.5" stroke="#A8853A" strokeWidth="1.4" strokeDasharray="3 2" />
        <text x="62" y="6" fontSize="9" fill="#2E2A24">Mem%</text>
      </g>
    </svg>
  );
}

function MetricsCurrent({ metrics }: { metrics: MetricSample[] }) {
  const last = metrics[metrics.length - 1];
  if (!last) return null;
  return (
    <div className="text-right">
      <div className="text-[11px] text-text-secondary/70 uppercase tracking-wider font-semibold">
        Now
      </div>
      <div className="text-sm">
        <span className="text-jewel-emerald font-mono font-semibold">{last.cpu}%</span>
        <span className="text-text-secondary/60 mx-1">cpu</span>
        <span className="text-jewel-topaz font-mono font-semibold">
          {last.mem_gb ? `${last.mem_gb} GB` : `${last.mem}%`}
        </span>
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="bg-bg-card rounded-2xl px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-wider font-semibold text-text-secondary">
        {label}
      </div>
      <div className="text-xl font-semibold text-text-primary leading-tight">{value}</div>
      {sub && <div className="text-[11px] text-text-secondary">{sub}</div>}
    </div>
  );
}

function HeaderBtn({
  label, k, sortKey, desc, onClick,
}: {
  label: string;
  k: SortKey;
  sortKey: SortKey;
  desc: boolean;
  onClick: (k: SortKey) => void;
}) {
  const active = k === sortKey;
  return (
    <button onClick={() => onClick(k)} className={`text-left ${active ? "text-accent" : ""}`}>
      {label}
      {active ? (desc ? " ↓" : " ↑") : ""}
    </button>
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
