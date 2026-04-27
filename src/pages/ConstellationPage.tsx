import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import type { Paper } from "../lib/types";
import { stripHtml, parseTitleType } from "../lib/text";

// Topic Constellation — prototype.
//
// Concept: each paper's summary.tags_suggested encodes 3–5 topics. Cluster
// the user's recent feed in topic space and render the result as a star
// map. Tags are bodies (sized by paper count). Edges are co-occurrences
// between tag pairs. Bridge papers — those whose tags span two otherwise
// distant clusters — are the "interesting unknowns."
//
// This is a hand-rolled force-directed layout (no d3 dep). Good enough
// for ~25 nodes; would need a real layout engine past 100.

interface TagNode {
  tag: string;
  count: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface TagEdge {
  a: string;
  b: string;
  weight: number;
}

const TOP_N_TAGS = 25;
const MIN_EDGE_WEIGHT = 2;
const ITERATIONS = 220;
const WIDTH = 360;
const HEIGHT = 480;

function normTag(s: string): string {
  return s.trim().toLowerCase();
}

function buildGraph(papers: Paper[]): { nodes: TagNode[]; edges: TagEdge[] } {
  // Tally tag frequency and pair co-occurrence.
  const freq = new Map<string, number>();
  const pair = new Map<string, number>();

  for (const p of papers) {
    const tags = (p.summary?.tags_suggested || [])
      .map(normTag)
      .filter(Boolean);
    const uniq = Array.from(new Set(tags));
    for (const t of uniq) freq.set(t, (freq.get(t) || 0) + 1);
    for (let i = 0; i < uniq.length; i++) {
      for (let j = i + 1; j < uniq.length; j++) {
        const key = uniq[i] < uniq[j] ? `${uniq[i]}|${uniq[j]}` : `${uniq[j]}|${uniq[i]}`;
        pair.set(key, (pair.get(key) || 0) + 1);
      }
    }
  }

  // Top-N tags by frequency, plus their connecting edges.
  const top = Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP_N_TAGS);
  const topSet = new Set(top.map(([t]) => t));
  const nodes: TagNode[] = top.map(([tag, count], i) => ({
    tag,
    count,
    // Seed positions on a circle so layout converges quickly.
    x: WIDTH / 2 + Math.cos((i / top.length) * Math.PI * 2) * 120,
    y: HEIGHT / 2 + Math.sin((i / top.length) * Math.PI * 2) * 120,
    vx: 0,
    vy: 0,
  }));

  const edges: TagEdge[] = [];
  for (const [key, weight] of pair.entries()) {
    if (weight < MIN_EDGE_WEIGHT) continue;
    const [a, b] = key.split("|");
    if (!topSet.has(a) || !topSet.has(b)) continue;
    edges.push({ a, b, weight });
  }

  return { nodes, edges };
}

function layout(nodes: TagNode[], edges: TagEdge[]) {
  // Tiny force sim: spring along edges, Coulomb repulsion between every
  // node pair, gentle pull toward center to keep things on screen.
  const idx = new Map(nodes.map((n, i) => [n.tag, i]));
  const k_repulse = 6500;
  const k_spring = 0.04;
  const target_len = 70;
  const damping = 0.82;
  const center_pull = 0.012;

  for (let step = 0; step < ITERATIONS; step++) {
    // Repulsion
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d2 = Math.max(dx * dx + dy * dy, 100);
        const f = k_repulse / d2;
        const d = Math.sqrt(d2);
        const fx = (dx / d) * f;
        const fy = (dy / d) * f;
        a.vx -= fx; a.vy -= fy;
        b.vx += fx; b.vy += fy;
      }
    }
    // Springs
    for (const e of edges) {
      const ai = idx.get(e.a)!, bi = idx.get(e.b)!;
      const a = nodes[ai], b = nodes[bi];
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      const stretch = d - target_len;
      const f = k_spring * stretch * Math.log(1 + e.weight);
      const fx = (dx / d) * f, fy = (dy / d) * f;
      a.vx += fx; a.vy += fy;
      b.vx -= fx; b.vy -= fy;
    }
    // Center gravity + integrate
    for (const n of nodes) {
      n.vx += (WIDTH / 2 - n.x) * center_pull;
      n.vy += (HEIGHT / 2 - n.y) * center_pull;
      n.vx *= damping; n.vy *= damping;
      n.x += n.vx; n.y += n.vy;
      // Clamp to viewport
      n.x = Math.max(40, Math.min(WIDTH - 40, n.x));
      n.y = Math.max(40, Math.min(HEIGHT - 40, n.y));
    }
  }
}

function bridgeScore(p: Paper, freq: Map<string, number>): number {
  // A bridge paper has tags from multiple "communities". Approximate
  // community as the rank quartile within the freq distribution — papers
  // mixing top-quartile tags with long-tail tags get the highest score.
  const tags = (p.summary?.tags_suggested || []).map(normTag);
  if (tags.length < 2) return 0;
  const counts = tags.map((t) => freq.get(t) || 0);
  const max = Math.max(...counts);
  const min = Math.min(...counts);
  return max - min;
}

export default function ConstellationPage() {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [showBridges, setShowBridges] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("papers")
        .select("id,title,journal,summary,relevance_score,authors,doi,published_at")
        .not("summary", "is", null)
        .order("relevance_score", { ascending: false })
        .limit(120);
      setPapers((data as Paper[]) || []);
      setLoading(false);
    })();
  }, []);

  const { nodes, edges, freq } = useMemo(() => {
    const g = buildGraph(papers);
    const f = new Map<string, number>();
    for (const n of g.nodes) f.set(n.tag, n.count);
    if (g.nodes.length > 0) layout(g.nodes, g.edges);
    return { nodes: g.nodes, edges: g.edges, freq: f };
  }, [papers]);

  const tagPapers = useMemo(() => {
    if (!activeTag) return [];
    return papers
      .filter((p) =>
        (p.summary?.tags_suggested || []).map(normTag).includes(activeTag),
      )
      .slice(0, 12);
  }, [activeTag, papers]);

  const bridges = useMemo(() => {
    return [...papers]
      .map((p) => ({ p, score: bridgeScore(p, freq) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(({ p }) => p);
  }, [papers, freq]);

  const maxCount = Math.max(1, ...nodes.map((n) => n.count));

  return (
    <div className="max-w-lg lg:max-w-4xl mx-auto px-5 lg:px-8 pt-10 pb-32">
      <div className="flex items-center gap-3 mb-2">
        <Link to="/" className="text-jewel-emerald text-sm font-medium">‹ Feed</Link>
        <span className="text-eyebrow font-semibold text-text-secondary uppercase tracking-wider">
          Prototype
        </span>
      </div>
      <h1 className="text-[34px] font-semibold text-text-primary leading-tight">
        Topic Constellation
      </h1>
      <p className="text-caption text-text-secondary mt-1">
        {loading
          ? "Mapping topics…"
          : `${nodes.length} topics · ${edges.length} links across ${papers.length} papers`}
      </p>

      <div className="mt-3 flex items-center gap-2 text-[12px]">
        <button
          onClick={() => setShowBridges((b) => !b)}
          className={`px-3 py-1.5 rounded-full font-semibold transition ${
            showBridges
              ? "bg-jewel-topaz text-white"
              : "bg-bg-card text-text-secondary border border-stroke"
          }`}
        >
          {showBridges ? "✦ Bridges on" : "Show bridges"}
        </button>
        {activeTag && (
          <button
            onClick={() => setActiveTag(null)}
            className="px-3 py-1.5 rounded-full font-medium text-text-secondary border border-stroke"
          >
            Clear filter
          </button>
        )}
      </div>

      {/* SVG canvas */}
      {!loading && nodes.length > 0 && (
        <div className="mt-4 bg-bg-card rounded-2xl overflow-hidden">
          <svg
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            className="w-full h-auto block"
            aria-label="Topic constellation"
          >
            {/* Edges */}
            {edges.map((e, i) => {
              const a = nodes.find((n) => n.tag === e.a)!;
              const b = nodes.find((n) => n.tag === e.b)!;
              const involves = !activeTag || activeTag === e.a || activeTag === e.b;
              return (
                <line
                  key={i}
                  x1={a.x} y1={a.y}
                  x2={b.x} y2={b.y}
                  stroke="#3F6E55"
                  strokeOpacity={involves ? 0.18 + Math.min(0.5, e.weight * 0.05) : 0.04}
                  strokeWidth={Math.min(3, 0.6 + e.weight * 0.25)}
                />
              );
            })}
            {/* Nodes */}
            {nodes.map((n) => {
              const r = 10 + 14 * (n.count / maxCount);
              const active = activeTag === n.tag;
              const dim = activeTag && !active && !edges.some(
                (e) => (e.a === activeTag && e.b === n.tag) || (e.b === activeTag && e.a === n.tag),
              );
              return (
                <g
                  key={n.tag}
                  transform={`translate(${n.x} ${n.y})`}
                  onClick={() => setActiveTag(active ? null : n.tag)}
                  style={{ cursor: "pointer", opacity: dim ? 0.25 : 1 }}
                >
                  <circle
                    r={r + (active ? 4 : 0)}
                    fill={active ? "#A8853A" : "#3F6E55"}
                    fillOpacity={0.85}
                    stroke="#FDFAF1"
                    strokeWidth={2}
                  />
                  <text
                    y={r + 12}
                    textAnchor="middle"
                    fontSize="9"
                    fill="#2E2A24"
                    style={{ fontFamily: "Charter, serif", pointerEvents: "none" }}
                  >
                    {n.tag.length > 22 ? n.tag.slice(0, 20) + "…" : n.tag}
                  </text>
                </g>
              );
            })}
            {/* Bridge paper halos */}
            {showBridges && bridges.map((p, i) => {
              const tags = (p.summary?.tags_suggested || []).map(normTag);
              const onCanvas = tags
                .map((t) => nodes.find((n) => n.tag === t))
                .filter((n): n is TagNode => !!n);
              if (onCanvas.length < 2) return null;
              const cx = onCanvas.reduce((s, n) => s + n.x, 0) / onCanvas.length;
              const cy = onCanvas.reduce((s, n) => s + n.y, 0) / onCanvas.length;
              return (
                <g
                  key={i}
                  transform={`translate(${cx} ${cy})`}
                  onClick={() => navigate(`/paper/${p.id}`)}
                  style={{ cursor: "pointer" }}
                >
                  <circle r={6} fill="#A8853A" stroke="#FDFAF1" strokeWidth={1.5} />
                  <circle r={11} fill="none" stroke="#A8853A" strokeOpacity={0.4} />
                </g>
              );
            })}
          </svg>
        </div>
      )}

      {!loading && nodes.length === 0 && (
        <div className="mt-6 bg-bg-card rounded-2xl p-6 text-center">
          <p className="text-text-primary font-medium mb-1">Not enough tagged papers yet</p>
          <p className="text-caption text-text-secondary">
            The constellation needs ~20 papers with summaries and tags. Come back after a few briefings.
          </p>
        </div>
      )}

      {/* Filter drawer */}
      {activeTag && tagPapers.length > 0 && (
        <section className="mt-5">
          <div className="text-eyebrow font-semibold text-text-secondary uppercase tracking-wider mb-2">
            Papers tagged "{activeTag}"
          </div>
          <ul className="space-y-2">
            {tagPapers.map((p) => (
              <li key={p.id}>
                <Link
                  to={`/paper/${p.id}`}
                  className="block bg-bg-card rounded-card p-3 active:opacity-80"
                >
                  <div className="text-eyebrow font-semibold text-text-secondary uppercase tracking-wider line-clamp-1">
                    {p.journal || "Unknown journal"}
                  </div>
                  <div className="font-serif text-[15px] leading-snug text-text-primary line-clamp-2 mt-1">
                    {stripHtml(parseTitleType(p.title).display)}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Bridge list */}
      {showBridges && !activeTag && bridges.length > 0 && (
        <section className="mt-5">
          <div className="text-eyebrow font-semibold text-text-secondary uppercase tracking-wider mb-2">
            ✦ Bridge papers — span distant topics
          </div>
          <ul className="space-y-2">
            {bridges.map((p) => (
              <li key={p.id}>
                <Link
                  to={`/paper/${p.id}`}
                  className="block bg-bg-card rounded-card p-3 active:opacity-80 border-l-2 border-jewel-topaz"
                >
                  <div className="text-eyebrow font-semibold text-text-secondary uppercase tracking-wider line-clamp-1">
                    {p.journal || "Unknown journal"}
                  </div>
                  <div className="font-serif text-[15px] leading-snug text-text-primary line-clamp-2 mt-1">
                    {stripHtml(parseTitleType(p.title).display)}
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {(p.summary?.tags_suggested || []).slice(0, 4).map((t) => (
                      <span
                        key={t}
                        className="text-[10px] px-1.5 py-0.5 rounded-full bg-bg-primary text-text-secondary"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
