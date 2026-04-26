import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
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
  const [oaLoading, setOaLoading] = useState(false);
  const [followedAuthors, setFollowedAuthors] = useState<Set<string>>(new Set());
  const fileRef = useRef<HTMLInputElement | null>(null);
  const navigate = useNavigate();

  // Keyboard shortcuts: p toggles pin, esc returns to feed, [/] step through
  // the recent paper list cached on the feed (sequential nav inside the
  // current session). Skipped when typing or focused inside an input.
  useEffect(() => {
    function isTyping() {
      const t = document.activeElement;
      const tag = t?.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || (t as HTMLElement | null)?.isContentEditable;
    }
    async function step(direction: 1 | -1) {
      // Pull a small ordered slice; we don't have a session-cached list so
      // ask supabase for the same ordering FeedPage uses (relevance desc).
      const { data } = await supabase
        .from("papers")
        .select("id")
        .order("relevance_score", { ascending: false })
        .limit(60);
      const ids = ((data as { id: string }[]) || []).map((p) => p.id);
      const idx = paper ? ids.indexOf(paper.id) : -1;
      if (idx < 0) return;
      const nextIdx = idx + direction;
      if (nextIdx < 0 || nextIdx >= ids.length) return;
      navigate(`/paper/${ids[nextIdx]}`);
    }
    function onKey(e: KeyboardEvent) {
      if (isTyping() || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "Escape") { e.preventDefault(); navigate("/"); }
      else if (e.key === "p") { e.preventDefault(); togglePin(); }
      else if (e.key === "]") { e.preventDefault(); step(1); }
      else if (e.key === "[") { e.preventDefault(); step(-1); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paper, pinned]);

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
      const { data: seedRows } = await supabase
        .from("topic_seeds")
        .select("value")
        .eq("kind", "author");
      setFollowedAuthors(
        new Set(((seedRows as { value: string }[]) || []).map((r) => r.value)),
      );
    })();
  }, [id]);

  async function followAuthor(displayName: string) {
    const u = (await supabase.auth.getUser()).data.user;
    if (!u) return;
    const { error: err } = await supabase
      .from("topic_seeds")
      .insert({ user_id: u.id, kind: "author", value: displayName });
    if (err) {
      setFlash(`Couldn't follow: ${err.message}`);
    } else {
      setFollowedAuthors((s) => new Set(s).add(displayName));
      setFlash(`+ Following ${displayName} — new papers will surface`);
      if (navigator.vibrate) navigator.vibrate([10, 20, 10]);
    }
    setTimeout(() => setFlash(null), 2400);
  }

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

  async function findOpenAccess() {
    if (!paper?.doi) {
      setFlash("No DOI on this paper — can't query Unpaywall.");
      setTimeout(() => setFlash(null), 2000);
      return;
    }
    setOaLoading(true);
    try {
      // Unpaywall asks for a contact email per ToS; this is the project's.
      const res = await fetch(
        `https://api.unpaywall.org/v2/${encodeURIComponent(paper.doi)}?email=joshuafein@gmail.com`,
      );
      if (!res.ok) throw new Error(`Unpaywall ${res.status}`);
      const body = await res.json();
      const oa =
        body?.best_oa_location?.url_for_pdf ||
        body?.best_oa_location?.url ||
        null;
      if (oa) {
        window.open(oa, "_blank", "noopener,noreferrer");
        setFlash(`Opening open-access copy${body.best_oa_location.host_type ? ` (${body.best_oa_location.host_type})` : ""}`);
      } else {
        setFlash("No open-access version found.");
      }
    } catch (e: any) {
      setFlash(`Unpaywall lookup failed: ${e.message}`);
    }
    setOaLoading(false);
    setTimeout(() => setFlash(null), 2400);
  }

  async function sharePaper() {
    if (!paper) return;
    const target = paper.url || (paper.doi ? `https://doi.org/${paper.doi}` : "");
    const blurb = paper.summary?.tldr || paper.title;
    const text = `${paper.title}\n\n${blurb}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: paper.title, text, url: target });
        return;
      } catch (e: any) {
        if (e?.name === "AbortError") return; // user cancelled
        // fall through to copy fallback
      }
    }
    try {
      await navigator.clipboard.writeText(`${text}\n${target}`);
      setFlash("✓ Copied — paste anywhere");
    } catch {
      setFlash("Couldn't share or copy.");
    }
    setTimeout(() => setFlash(null), 1800);
  }

  async function copyCitation() {
    if (!paper) return;
    // Vancouver-ish: "Authors. Title. Journal. Year;Vol(Issue):pages. doi:X"
    // We don't store volume/issue/pages; degrade gracefully.
    const authors = (paper.authors || []).slice(0, 6).join(", ") +
      (paper.authors?.length > 6 ? ", et al" : "");
    const year = paper.published_at
      ? new Date(paper.published_at).getFullYear()
      : "";
    const parts = [
      authors ? `${authors}.` : "",
      paper.title ? `${paper.title.replace(/[.\s]+$/, "")}.` : "",
      paper.journal ? `${paper.journal}.` : "",
      year ? `${year}.` : "",
      paper.doi ? `doi:${paper.doi}` : "",
    ].filter(Boolean);
    const cite = parts.join(" ");
    try {
      await navigator.clipboard.writeText(cite);
      setFlash("✓ Citation copied");
    } catch {
      setFlash("Couldn't copy — long-press to select instead.");
    }
    setTimeout(() => setFlash(null), 1800);
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

      <PreprintLink paper={paper} />


      {/* Follow first / last author chips. Senior author (last) is usually
          the PI — most useful target for "follow this lab". First-author also
          surfaced because trainees are mobile and worth tracking. */}
      {paper.authors && paper.authors.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {Array.from(new Set([
            paper.authors[paper.authors.length - 1],
            paper.authors[0],
          ].filter(Boolean))).map((author) => {
            const following = followedAuthors.has(author);
            const isSenior = author === paper.authors[paper.authors.length - 1];
            return (
              <button
                key={author}
                disabled={following}
                onClick={() => followAuthor(author)}
                className={`text-[11px] font-semibold px-2.5 py-1 rounded-full transition ${
                  following
                    ? "bg-jewel-emerald/15 text-jewel-emerald cursor-default"
                    : "bg-bg-card text-text-secondary hover:text-text-primary border border-stroke"
                }`}
                title={following ? "Already following" : `Add ${author} as a seed`}
              >
                {following ? "✓ following" : "+ follow"} {author}
                {isSenior && !following && (
                  <span className="ml-1 text-text-secondary/60 text-[9px] uppercase tracking-wider">
                    PI
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

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
          {paper.doi && (
            <button
              onClick={findOpenAccess}
              disabled={oaLoading}
              className="w-full flex items-center justify-between bg-bg-card text-text-primary rounded-xl px-4 py-3 text-sm font-medium active:opacity-80 border border-stroke disabled:opacity-50"
            >
              <span>{oaLoading ? "Searching Unpaywall…" : "Find open-access copy"}</span>
              <span className="opacity-60">🔓</span>
            </button>
          )}
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
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={copyCitation}
              className="flex items-center justify-between bg-bg-card text-text-primary rounded-xl px-4 py-3 text-sm font-medium active:opacity-80 border border-stroke"
            >
              <span>Copy citation</span>
              <span className="opacity-60">⎘</span>
            </button>
            <button
              onClick={sharePaper}
              className="flex items-center justify-between bg-bg-card text-text-primary rounded-xl px-4 py-3 text-sm font-medium active:opacity-80 border border-stroke"
            >
              <span>Share</span>
              <span className="opacity-60">↗</span>
            </button>
          </div>
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

// Cross-link banner: shown when this paper is the preprint of a now-
// published article OR the published version of an earlier preprint.
// Resolves the linked DOI to a paper row in the user's own table when
// possible (so the link goes to /paper/<id>); falls back to doi.org.
function PreprintLink({ paper }: { paper: Paper }) {
  const [linkedTitle, setLinkedTitle] = useState<string | null>(null);
  const [linkedJournal, setLinkedJournal] = useState<string | null>(null);
  const [linkedId, setLinkedId] = useState<string | null>(null);

  const isPreprint = !!paper.published_doi;
  const otherDoi = paper.published_doi || paper.preprint_doi;

  useEffect(() => {
    if (!otherDoi) return;
    (async () => {
      const { data } = await supabase
        .from("papers")
        .select("id,title,journal")
        .eq("doi", otherDoi)
        .limit(1)
        .maybeSingle();
      if (data) {
        setLinkedId((data as any).id);
        setLinkedTitle((data as any).title);
        setLinkedJournal((data as any).journal);
      }
    })();
  }, [otherDoi]);

  if (!otherDoi) return null;

  const label = isPreprint
    ? linkedJournal
      ? `✓ Now published in ${linkedJournal}`
      : "✓ Now peer-reviewed and published"
    : "○ Originally posted as a preprint";
  const tone = isPreprint ? "bg-jewel-emerald/10 text-jewel-emerald border-jewel-emerald/20" : "bg-jewel-topaz/10 text-jewel-topaz border-jewel-topaz/20";
  const href = linkedId ? `/paper/${linkedId}` : `https://doi.org/${otherDoi}`;
  const internal = !!linkedId;

  const inner = (
    <div className={`mt-3 rounded-xl border px-3 py-2 text-caption ${tone}`}>
      <div className="font-semibold">{label}</div>
      {linkedTitle && (
        <div className="text-text-primary mt-0.5 line-clamp-2 font-serif text-[13px]">
          {linkedTitle}
        </div>
      )}
    </div>
  );
  return internal ? (
    <Link to={href}>{inner}</Link>
  ) : (
    <a href={href} target="_blank" rel="noreferrer">{inner}</a>
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
