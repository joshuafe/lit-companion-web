import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import type { Paper } from "../lib/types";

export default function PaperDetailPage() {
  const { id } = useParams();
  const [paper, setPaper] = useState<Paper | null>(null);
  const [pinned, setPinned] = useState(false);
  const [proxyTemplate, setProxyTemplate] = useState<string | null>(null);
  const [pdfPath, setPdfPath] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

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
      const { data: profile } = await supabase
        .from("profiles")
        .select("proxy_url_template")
        .maybeSingle();
      setProxyTemplate((profile as any)?.proxy_url_template ?? null);
      // Check if a PDF already exists for this paper.
      const u = (await supabase.auth.getUser()).data.user;
      if (u) {
        const key = `${u.id}/${id}.pdf`;
        const { data: list } = await supabase.storage
          .from("paper-pdfs")
          .list(u.id, { search: `${id}.pdf` });
        if (list?.some((f) => f.name === `${id}.pdf`)) setPdfPath(key);
      }
    })();
  }, [id]);

  async function togglePin() {
    if (!paper) return;
    const u = (await supabase.auth.getUser()).data.user;
    if (!u) return;
    if (pinned) {
      await supabase.from("pins").delete().eq("paper_id", paper.id).eq("user_id", u.id);
      setPinned(false);
      setFlash("Removed from Library");
    } else {
      await supabase.from("pins").insert({ user_id: u.id, paper_id: paper.id });
      setPinned(true);
      setFlash("★ Saved to Library");
      if (navigator.vibrate) navigator.vibrate([18, 30, 12]);
    }
    setTimeout(() => setFlash(null), 1800);
  }

  async function dismiss() {
    if (!paper) return;
    const u = (await supabase.auth.getUser()).data.user;
    if (!u) return;
    await supabase.from("dismissals").upsert({ user_id: u.id, paper_id: paper.id });
    setFlash("Dismissed — find it in Library to restore");
    setTimeout(() => setFlash(null), 2200);
  }

  function openViaProxy() {
    if (!paper) return;
    if (!proxyTemplate || !proxyTemplate.trim()) {
      setFlash("Set up your institutional proxy in Settings first.");
      setTimeout(() => setFlash(null), 2400);
      return;
    }
    const target = paper.url || (paper.doi ? `https://doi.org/${paper.doi}` : null);
    if (!target) return;
    const proxied = proxyTemplate.includes("{url}")
      ? proxyTemplate.replace("{url}", encodeURIComponent(target))
      : proxyTemplate + encodeURIComponent(target);
    window.open(proxied, "_blank", "noopener,noreferrer");
  }

  async function uploadPdf(file: File) {
    if (!paper) return;
    setUploading(true);
    const u = (await supabase.auth.getUser()).data.user;
    if (!u) { setUploading(false); return; }
    const key = `${u.id}/${paper.id}.pdf`;
    const { error } = await supabase.storage
      .from("paper-pdfs")
      .upload(key, file, { contentType: "application/pdf", upsert: true });
    setUploading(false);
    if (error) {
      setFlash(`Upload failed: ${error.message}`);
    } else {
      setPdfPath(key);
      setFlash(`✓ PDF saved (${(file.size / 1024).toFixed(0)} KB)`);
    }
    setTimeout(() => setFlash(null), 2400);
  }

  async function viewPdf() {
    if (!pdfPath) return;
    const { data, error } = await supabase.storage
      .from("paper-pdfs")
      .createSignedUrl(pdfPath, 3600);
    if (error || !data) {
      setFlash(`Couldn't open PDF: ${error?.message}`);
      setTimeout(() => setFlash(null), 2200);
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  if (!paper) return <div className="px-5 py-16 text-center text-text-secondary">Loading…</div>;
  const s = paper.summary;
  const inst = paper.last_author_institution || paper.first_author_institution;

  return (
    <div className="max-w-lg mx-auto px-5 pt-6 pb-32">
      <Link to="/" className="text-jewel-emerald text-sm font-medium">‹ Feed</Link>

      <div className="mt-4 text-eyebrow font-semibold text-text-secondary uppercase tracking-wider">
        {paper.journal || ""}
      </div>
      <h1 className="mt-2 text-[22px] font-semibold leading-snug text-text-primary">
        {paper.title}
      </h1>
      <div className="mt-1 text-caption text-text-secondary">
        {(paper.authors || []).slice(0, 8).join(", ")}
        {paper.authors?.length > 8 ? ", et al." : ""}
        {inst && <span className="text-text-secondary/80"> · {inst}</span>}
      </div>

      {s ? (
        <>
          <Section label="KEY CLAIM" body={s.key_claim} />
          <div className="mt-4 bg-bg-card rounded-xl p-4 font-serif text-[16px] leading-relaxed text-text-primary">
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

      {/* Full-text access section */}
      <div className="mt-6 border-t border-stroke pt-5">
        <div className="text-eyebrow font-semibold text-text-secondary uppercase tracking-wider mb-3">
          Full text
        </div>
        <div className="space-y-2">
          <a
            href={paper.url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between bg-jewel-emerald text-white rounded-xl px-4 py-3 text-sm font-semibold active:opacity-80"
          >
            <span>Open at publisher</span>
            <span className="opacity-80">↗</span>
          </a>
          <button
            onClick={openViaProxy}
            className="w-full flex items-center justify-between bg-bg-card text-text-primary rounded-xl px-4 py-3 text-sm font-medium active:opacity-80 border border-stroke"
            title={proxyTemplate ? `Via ${new URL(proxyTemplate.split('?')[0]).hostname}` : "Set proxy in Settings"}
          >
            <span>{proxyTemplate ? "Open via my institutional proxy" : "Set up institutional proxy →"}</span>
            <span className="opacity-60">↗</span>
          </button>
          {pdfPath ? (
            <button
              onClick={viewPdf}
              className="w-full flex items-center justify-between bg-bg-card text-text-primary rounded-xl px-4 py-3 text-sm font-medium active:opacity-80 border border-stroke"
            >
              <span>📄 Open saved PDF</span>
              <span className="text-jewel-emerald">✓</span>
            </button>
          ) : (
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="w-full flex items-center justify-between bg-bg-card text-text-primary rounded-xl px-4 py-3 text-sm font-medium active:opacity-80 border border-stroke disabled:opacity-50"
            >
              <span>{uploading ? "Uploading…" : "Upload PDF (after downloading)"}</span>
              <span className="opacity-60">⬆</span>
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) uploadPdf(f);
              e.target.value = "";
            }}
          />
        </div>
      </div>

      {/* Sticky action bar */}
      <div className="fixed bottom-16 inset-x-0 bg-bg-primary/95 backdrop-blur border-t border-stroke">
        <div className="max-w-lg mx-auto flex gap-1 px-2 py-2">
          <button
            onClick={togglePin}
            className={`flex-1 font-medium text-sm py-2 ${pinned ? "text-jewel-topaz" : "text-jewel-emerald"}`}
          >
            {pinned ? "★ Saved · Unpin" : "★ Save"}
          </button>
          <button
            onClick={dismiss}
            className="flex-1 text-text-secondary font-medium text-sm py-2"
          >
            Dismiss
          </button>
        </div>
      </div>

      {flash && (
        <div className="fixed bottom-32 inset-x-0 flex justify-center px-4 z-20 pointer-events-none">
          <div className="bg-text-primary text-bg-primary text-sm px-4 py-2 rounded-full shadow-lg">
            {flash}
          </div>
        </div>
      )}
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
