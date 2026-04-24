import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase, SUPABASE_URL } from "../lib/supabase";

interface Paper {
  id: string;
  source_id: string;
  title: string;
  journal: string | null;
  published_at: string | null;
  relevance_score: number | null;
  pinned: boolean;
  dismissed: boolean;
  in_briefing: boolean;
  url: string;
}
interface Seed { id: string; kind: string; value: string; created_at: string; processed_at: string | null }
interface Briefing { briefing_date: string; paper_ids: string[]; audio_path: string | null; transcript: string | null; generated_at: string }
interface JournalRow { name: string; count: number; avg_score: number | null }
interface Detail {
  user_id: string;
  email: string | null;
  profile: any;
  seeds: Seed[];
  papers: Paper[];
  pins: { paper_id: string; pinned_at: string; note: string | null }[];
  dismissals: { paper_id: string; dismissed_at: string }[];
  briefings: Briefing[];
  journals: JournalRow[];
  histogram: number[];
  recency: { days: number; score: number; in_briefing: boolean; pinned: boolean }[];
}

export default function AdminUserDetailPage() {
  const { userId = "" } = useParams();
  const [data, setData] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setError("Not signed in."); setLoading(false); return; }
    try {
      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/admin-user-detail?user_id=${userId}`,
        { headers: { Authorization: `Bearer ${session.access_token}` } },
      );
      if (!res.ok) { setError(`${res.status}: ${await res.text()}`); setLoading(false); return; }
      setData(await res.json());
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  }

  useEffect(() => { if (userId) load(); }, [userId]);

  return (
    <div className="max-w-5xl mx-auto px-4 pt-10 pb-16">
      <div className="flex items-center gap-3 mb-4">
        <Link to="/admin" className="text-accent text-sm font-medium">← Admin</Link>
        <button onClick={load} disabled={loading} className="ml-auto text-sm text-accent font-medium disabled:opacity-50">
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {error && <div className="mb-4 text-sm text-red-600 bg-red-50 rounded-xl p-3 break-all">{error}</div>}
      {loading && !data && <div className="text-caption text-text-secondary">Loading user detail…</div>}

      {data && (
        <>
          <div className="mb-6">
            <h1 className="text-[28px] font-semibold text-text-primary">
              {data.email || "(no email)"}
            </h1>
            <div className="text-caption text-text-secondary">{data.user_id}</div>
          </div>

          {/* Interest signature */}
          <Section title="Interest shaping">
            <div className="space-y-3">
              <div>
                <div className="text-eyebrow font-semibold text-text-secondary uppercase tracking-wider mb-1">
                  Interest text
                </div>
                <div className="text-sm text-text-primary">
                  {data.profile?.interest_text || "—"}
                </div>
              </div>
              <EmbeddingGlyph vec={data.profile?.interest_embedding} />
              <div>
                <div className="text-eyebrow font-semibold text-text-secondary uppercase tracking-wider mb-1">
                  Seeds ({data.seeds.length})
                </div>
                <ul className="space-y-1 text-sm">
                  {data.seeds.map((s) => (
                    <li key={s.id} className="text-text-primary">
                      <span className="inline-block bg-bg-primary rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider font-semibold text-text-secondary mr-2">
                        {s.kind}
                      </span>
                      {s.value}
                      {s.processed_at ? (
                        <span className="ml-2 text-[11px] text-relevance-high">● embedded</span>
                      ) : (
                        <span className="ml-2 text-[11px] text-accent">○ pending</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
              <KeywordCloud papers={data.papers.slice(0, 40)} />
            </div>
          </Section>

          {/* Score distribution */}
          <Section title="Affinity score distribution">
            <ScoreHistogram bins={data.histogram} total={data.papers.length} />
            <p className="mt-2 text-caption text-text-secondary">
              {data.papers.length} papers. Bars colored by tier
              (≥0.80 warm, 0.60–0.80 mid, &lt;0.60 cool).
            </p>
          </Section>

          {/* Top papers */}
          <Section title="Top 20 papers — what the algorithm picks">
            <TopPapers papers={data.papers.slice(0, 20)} />
          </Section>

          {/* Journal breakdown */}
          <Section title="Journal representation">
            <JournalTable rows={data.journals} />
          </Section>

          {/* Recency vs score scatter */}
          <Section title="Freshness vs. relevance">
            <RecencyScatter points={data.recency} />
            <p className="mt-2 text-caption text-text-secondary">
              x = days since publication · y = relevance · green = in briefing · gold = pinned.
              Ideal: newer papers cluster high-relevance in the left third.
            </p>
          </Section>

          {/* Briefing composition */}
          <Section title="Recent briefings">
            <BriefingTimeline briefings={data.briefings} papers={data.papers} />
          </Section>
        </>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: any }) {
  return (
    <section className="bg-bg-card rounded-2xl p-4 mb-4">
      <h2 className="text-[15px] font-semibold text-text-primary mb-3">{title}</h2>
      {children}
    </section>
  );
}

function EmbeddingGlyph({ vec }: { vec?: number[] | null }) {
  if (!vec || !Array.isArray(vec) || vec.length === 0) {
    return (
      <div className="text-caption text-text-secondary">No interest embedding yet.</div>
    );
  }
  // Compress 768-dim vector to 48 bars by averaging chunks, map to warm/cool hues.
  const N = 48;
  const step = Math.floor(vec.length / N);
  const bars: number[] = [];
  for (let i = 0; i < N; i++) {
    let sum = 0;
    for (let j = 0; j < step; j++) sum += vec[i * step + j] ?? 0;
    bars.push(sum / step);
  }
  const min = Math.min(...bars);
  const max = Math.max(...bars);
  const scale = (v: number) => (max === min ? 0.5 : (v - min) / (max - min));
  return (
    <div>
      <div className="text-eyebrow font-semibold text-text-secondary uppercase tracking-wider mb-1">
        Embedding signature (compressed · {vec.length}-dim)
      </div>
      <div className="flex gap-[2px] h-10 rounded overflow-hidden">
        {bars.map((b, i) => {
          const v = scale(b);
          const hue = v * 32; // 0 = terracotta, 32 = gold
          const light = 40 + v * 35;
          return (
            <div
              key={i}
              className="flex-1 h-full"
              style={{ background: `hsl(${hue + 10}, ${30 + v * 25}%, ${light}%)` }}
              title={b.toFixed(3)}
            />
          );
        })}
      </div>
    </div>
  );
}

function KeywordCloud({ papers }: { papers: Paper[] }) {
  const keywords = useMemo(() => {
    const stop = new Set([
      "the","a","an","of","in","on","for","to","and","or","with","by","from","as",
      "is","are","at","be","this","that","we","our","using","via","new","novel",
      "study","studies","analysis","results","paper","between","into","after",
    ]);
    const counts: Record<string, number> = {};
    for (const p of papers) {
      const words = (p.title || "").toLowerCase().split(/[^a-z0-9]+/);
      for (const w of words) {
        if (w.length < 4 || stop.has(w)) continue;
        counts[w] = (counts[w] || 0) + 1;
      }
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 24);
  }, [papers]);

  if (keywords.length === 0) return null;
  const maxCount = keywords[0][1];
  return (
    <div>
      <div className="text-eyebrow font-semibold text-text-secondary uppercase tracking-wider mb-1">
        Top-paper keyword cloud
      </div>
      <div className="flex flex-wrap gap-x-2 gap-y-1">
        {keywords.map(([word, n]) => {
          const size = 11 + (n / maxCount) * 13;
          const weight = 400 + Math.round((n / maxCount) * 3) * 100;
          return (
            <span
              key={word}
              className="text-accent"
              style={{ fontSize: `${size}px`, fontWeight: weight, opacity: 0.5 + (n / maxCount) * 0.5 }}
              title={`${n}×`}
            >
              {word}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function ScoreHistogram({ bins, total }: { bins: number[]; total: number }) {
  const max = Math.max(...bins, 1);
  const BIN_COUNT = bins.length;
  return (
    <svg viewBox={`0 0 ${BIN_COUNT * 16} 110`} className="w-full h-32">
      {bins.map((count, i) => {
        const h = (count / max) * 95;
        const score = (i + 0.5) / BIN_COUNT;
        const color = score >= 0.8 ? "#B86E4C" : score >= 0.6 ? "#B79F7C" : "#9AA395";
        return (
          <g key={i}>
            <rect
              x={i * 16 + 2}
              y={100 - h}
              width={12}
              height={h}
              fill={color}
              opacity={count > 0 ? 1 : 0.15}
              rx={2}
            />
            {count > 0 && (
              <text x={i * 16 + 8} y={100 - h - 3} fontSize="8" fill="#7D7266" textAnchor="middle">
                {count}
              </text>
            )}
          </g>
        );
      })}
      <line x1="0" y1="100" x2={BIN_COUNT * 16} y2="100" stroke="#2E2A24" strokeWidth="1" opacity="0.3" />
      <text x="4" y="108" fontSize="9" fill="#7D7266">0.0</text>
      <text x={BIN_COUNT * 8 - 6} y="108" fontSize="9" fill="#7D7266">0.5</text>
      <text x={BIN_COUNT * 16 - 22} y="108" fontSize="9" fill="#7D7266">1.0</text>
      <text x={BIN_COUNT * 16 - 40} y="10" fontSize="9" fill="#7D7266" textAnchor="end">n={total}</text>
    </svg>
  );
}

function TopPapers({ papers }: { papers: Paper[] }) {
  if (!papers.length) return <div className="text-caption text-text-secondary">No papers yet.</div>;
  const max = papers[0].relevance_score ?? 1;
  return (
    <ul className="space-y-1.5">
      {papers.map((p, i) => {
        const score = p.relevance_score ?? 0;
        const pct = (score / max) * 100;
        const color = score >= 0.8 ? "bg-relevance-high" : score >= 0.6 ? "bg-relevance-mid" : "bg-relevance-low";
        return (
          <li key={p.id} className="flex items-center gap-2">
            <span className="w-6 text-[11px] text-text-secondary shrink-0 text-right">{i + 1}</span>
            <div className="flex-1 min-w-0">
              <div className="relative h-6 rounded overflow-hidden bg-bg-primary">
                <div className={`absolute inset-y-0 left-0 ${color}`} style={{ width: `${pct}%` }} />
                <div className="relative px-2 py-0.5 flex items-center gap-2 h-full">
                  <span className="text-[11px] text-text-primary font-mono shrink-0">
                    {Math.round(score * 100)}
                  </span>
                  <span className="text-[12px] text-text-primary truncate">
                    {p.title}
                  </span>
                </div>
              </div>
              <div className="flex gap-2 mt-0.5 text-[10px] text-text-secondary">
                <span className="truncate">{p.journal || "—"}</span>
                {p.pinned && <span className="text-relevance-high">★</span>}
                {p.dismissed && <span className="text-text-secondary">✕</span>}
                {p.in_briefing && <span className="text-accent">📻 briefed</span>}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function JournalTable({ rows }: { rows: JournalRow[] }) {
  if (!rows.length) return <div className="text-caption text-text-secondary">No journal data.</div>;
  const maxCount = Math.max(...rows.map((r) => r.count));
  return (
    <ul className="space-y-1.5">
      {rows.map((r) => (
        <li key={r.name} className="grid grid-cols-[1.6fr_2fr_0.7fr] gap-2 items-center">
          <span className="text-sm text-text-primary truncate">{r.name}</span>
          <div className="relative h-5 rounded bg-bg-primary overflow-hidden">
            <div className="absolute inset-y-0 left-0 bg-accent/60" style={{ width: `${(r.count / maxCount) * 100}%` }} />
            <span className="relative px-2 text-[11px] font-mono text-text-primary leading-5">
              {r.count}
            </span>
          </div>
          <span className="text-[11px] text-text-secondary text-right">
            avg {r.avg_score != null ? Math.round(r.avg_score * 100) : "—"}
          </span>
        </li>
      ))}
    </ul>
  );
}

function RecencyScatter({ points }: { points: Detail["recency"] }) {
  if (!points.length) return <div className="text-caption text-text-secondary">No timestamped papers.</div>;
  const maxDays = Math.max(...points.map((p) => p.days), 30);
  const W = 400, H = 160, PAD = 20;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-44">
      {/* grid */}
      <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="#2E2A24" strokeOpacity="0.2" />
      <line x1={PAD} y1={PAD} x2={PAD} y2={H - PAD} stroke="#2E2A24" strokeOpacity="0.2" />
      {[0.5, 1].map((g, i) => (
        <line
          key={i}
          x1={PAD}
          y1={H - PAD - g * (H - 2 * PAD)}
          x2={W - PAD}
          y2={H - PAD - g * (H - 2 * PAD)}
          stroke="#2E2A24"
          strokeOpacity="0.08"
        />
      ))}
      {points.map((p, i) => {
        const x = PAD + (1 - p.days / maxDays) * (W - 2 * PAD);
        const y = H - PAD - p.score * (H - 2 * PAD);
        const fill = p.pinned ? "#D9A54C" : p.in_briefing ? "#7B9A76" : "#B86E4C";
        const opacity = p.in_briefing || p.pinned ? 0.95 : 0.55;
        const r = p.pinned ? 4 : 3;
        return <circle key={i} cx={x} cy={y} r={r} fill={fill} opacity={opacity} />;
      })}
      <text x={PAD} y={H - 4} fontSize="9" fill="#7D7266">{maxDays}d ago</text>
      <text x={W - PAD - 14} y={H - 4} fontSize="9" fill="#7D7266">now</text>
      <text x={4} y={PAD + 4} fontSize="9" fill="#7D7266">1.0</text>
      <text x={4} y={H - PAD + 3} fontSize="9" fill="#7D7266">0.0</text>
    </svg>
  );
}

function BriefingTimeline({ briefings, papers }: { briefings: Briefing[]; papers: Paper[] }) {
  if (!briefings.length) return <div className="text-caption text-text-secondary">No briefings yet.</div>;
  const paperById: Record<string, Paper> = {};
  for (const p of papers) paperById[p.source_id] = p;
  return (
    <ul className="space-y-3">
      {briefings.map((b) => (
        <li key={b.briefing_date} className="border-l-2 border-accent/40 pl-3">
          <div className="text-sm font-semibold text-text-primary">
            {new Date(b.briefing_date + "T00:00:00").toLocaleDateString("en-US", {
              weekday: "short", month: "short", day: "numeric",
            })}
            <span className="ml-2 text-caption text-text-secondary">
              {b.paper_ids.length} papers{b.audio_path ? " · audio ✓" : ""}
            </span>
          </div>
          <ul className="mt-1 space-y-0.5">
            {b.paper_ids.slice(0, 5).map((pid) => {
              const p = paperById[pid];
              return (
                <li key={pid} className="text-[12px] text-text-primary truncate">
                  {p ? `${Math.round((p.relevance_score ?? 0) * 100)} · ${p.title}` : pid.slice(0, 8)}
                </li>
              );
            })}
            {b.paper_ids.length > 5 && (
              <li className="text-[11px] text-text-secondary">
                +{b.paper_ids.length - 5} more
              </li>
            )}
          </ul>
        </li>
      ))}
    </ul>
  );
}
