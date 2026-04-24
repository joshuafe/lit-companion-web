import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import type { Paper } from "../lib/types";

export default function PaperDetailPage() {
  const { id } = useParams();
  const [paper, setPaper] = useState<Paper | null>(null);
  const [pinned, setPinned] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data } = await supabase.from("papers").select().eq("id", id).single();
      setPaper(data as Paper);
      const { data: pins } = await supabase
        .from("pins")
        .select("paper_id")
        .eq("paper_id", id)
        .limit(1);
      setPinned((pins?.length ?? 0) > 0);
    })();
  }, [id]);

  async function togglePin() {
    if (!paper) return;
    if (pinned) {
      await supabase.from("pins").delete().eq("paper_id", paper.id);
      setPinned(false);
    } else {
      const u = (await supabase.auth.getUser()).data.user;
      if (!u) return;
      await supabase.from("pins").insert({ user_id: u.id, paper_id: paper.id });
      setPinned(true);
    }
  }

  async function dismiss() {
    if (!paper) return;
    const u = (await supabase.auth.getUser()).data.user;
    if (!u) return;
    await supabase
      .from("dismissals")
      .upsert({ user_id: u.id, paper_id: paper.id });
  }

  if (!paper) return <div className="px-5 py-16 text-center text-text-secondary">Loading…</div>;
  const s = paper.summary;

  return (
    <div className="max-w-lg mx-auto px-5 pt-6 pb-32">
      <Link to="/" className="text-accent text-sm">‹ Feed</Link>

      <div className="mt-4 text-eyebrow font-semibold text-text-secondary uppercase tracking-wider">
        {paper.journal || ""}
      </div>
      <h1 className="mt-2 text-[22px] font-semibold leading-snug text-text-primary">
        {paper.title}
      </h1>
      <div className="mt-1 text-caption text-text-secondary">
        {(paper.authors || []).slice(0, 8).join(", ")}
        {paper.authors?.length > 8 ? ", et al." : ""}
      </div>

      {s ? (
        <>
          <Section label="KEY CLAIM" body={s.key_claim} />
          <div className="mt-4 bg-bg-card rounded-xl p-4 text-[14px] font-medium text-text-primary">
            {s.tldr}
          </div>

          {s.figure_highlight && (
            <Section label="FIGURE HIGHLIGHT" body={s.figure_highlight} />
          )}

          <div className="mt-5">
            <div className="text-eyebrow font-semibold text-text-secondary uppercase tracking-wider">
              METHODS
            </div>
            <div className="mt-1 text-caption text-text-primary space-y-1">
              <div>Design · {s.methods.design}</div>
              <div>System · {s.methods.population_or_system}</div>
              {s.methods.measures?.length > 0 && (
                <div>Measures · {s.methods.measures.join(", ")}</div>
              )}
            </div>
          </div>

          <div className="mt-5">
            <div className="text-eyebrow font-semibold text-text-secondary uppercase tracking-wider">
              FINDINGS
            </div>
            <ul className="mt-2 text-caption text-text-primary space-y-1.5">
              {s.findings.map((f, i) => (
                <li key={i}>
                  • {f.statement} — <span className="text-text-secondary">{f.magnitude}</span>
                </li>
              ))}
            </ul>
          </div>

          {s.limitations?.length > 0 && (
            <div className="mt-5 bg-warn-bg rounded-xl p-4">
              <div className="text-eyebrow font-semibold text-text-secondary uppercase tracking-wider">
                LIMITATIONS
              </div>
              <ul className="mt-2 text-caption text-text-primary space-y-1.5">
                {s.limitations.map((l, i) => (
                  <li key={i}>• {l}</li>
                ))}
              </ul>
            </div>
          )}

          {s.relevance?.reason && (
            <Section label="WHY YOU'RE SEEING THIS" body={s.relevance.reason} dim />
          )}
        </>
      ) : paper.abstract ? (
        <Section label="ABSTRACT" body={paper.abstract} />
      ) : (
        <p className="mt-6 text-text-secondary">
          No structured summary yet — full summarization will land in the next pipeline run.
        </p>
      )}

      {/* Sticky action bar */}
      <div className="fixed bottom-16 inset-x-0 bg-bg-primary/95 backdrop-blur border-t border-stroke">
        <div className="max-w-lg mx-auto flex gap-1 px-2 py-2">
          <button
            onClick={togglePin}
            className="flex-1 text-accent font-medium text-sm py-2"
          >
            {pinned ? "Unpin" : "Pin"}
          </button>
          <button
            onClick={dismiss}
            className="flex-1 text-accent font-medium text-sm py-2"
          >
            Dismiss
          </button>
          <a
            href={paper.url}
            target="_blank"
            rel="noreferrer"
            className="flex-1 text-accent font-medium text-sm py-2 text-center"
          >
            Source
          </a>
        </div>
      </div>
    </div>
  );
}

function Section({ label, body, dim }: { label: string; body: string; dim?: boolean }) {
  return (
    <div className="mt-5">
      <div className="text-eyebrow font-semibold text-text-secondary uppercase tracking-wider">
        {label}
      </div>
      <p className={`mt-1 ${dim ? "text-caption text-text-secondary" : "text-base text-text-primary"}`}>
        {body}
      </p>
    </div>
  );
}
