import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

// pdfjs is heavyweight; lazy-import the API + worker only when the user
// actually uploads a PDF. Keeps the main bundle skinny.
async function loadPdfjs() {
  const pdfjs = await import("pdfjs-dist");
  // Vite will fingerprint and serve the worker; we point pdfjs at it.
  // @ts-expect-error vite ?url import
  const worker = (await import("pdfjs-dist/build/pdf.worker.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = worker;
  return pdfjs;
}

const DOI_RE = /\b(10\.\d{4,9}\/[^\s"<>]+?)(?=[)>\]\s.,;]|$)/i;

interface Metadata {
  doi: string;
  title: string;
  authors: string[];
  journal: string | null;
  year: number | null;
  abstract: string | null;
  url: string | null;
}

async function extractDoiFromPdf(file: File): Promise<string | null> {
  const pdfjs = await loadPdfjs();
  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
  // Scan first 3 pages — DOI is almost always on page 1, sometimes
  // running header/footer on later pages.
  const limit = Math.min(3, doc.numPages);
  for (let i = 1; i <= limit; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const text = content.items.map((it: any) => it.str).join(" ");
    const m = text.match(DOI_RE);
    if (m) return m[1].replace(/[.,;]+$/, "");
  }
  return null;
}

async function lookupCrossref(doi: string): Promise<Metadata | null> {
  // Crossref is free, no API key, polite-rate-limited if you set a UA.
  const res = await fetch(
    `https://api.crossref.org/works/${encodeURIComponent(doi)}`,
    { headers: { "User-Agent": "LiteratureCompanion/0.1 (mailto:joshuafein@gmail.com)" } },
  );
  if (!res.ok) return null;
  const body = await res.json();
  const w = body?.message;
  if (!w) return null;
  const title = (w.title?.[0] || "").trim();
  const authors = (w.author || []).map((a: any) => {
    const given = a.given || "";
    const family = a.family || "";
    // PubMed-format: "Family Initials" — convert "John A. Smith" → "Smith JA"
    const initials = given.split(/\s+/).map((p: string) => p[0]).filter(Boolean).join("");
    return `${family}${initials ? " " + initials : ""}`.trim();
  }).filter(Boolean);
  const journal =
    w["container-title"]?.[0] ||
    w["short-container-title"]?.[0] ||
    null;
  const year =
    w.published?.["date-parts"]?.[0]?.[0] ||
    w["published-print"]?.["date-parts"]?.[0]?.[0] ||
    w["published-online"]?.["date-parts"]?.[0]?.[0] ||
    null;
  // Crossref `abstract` is JATS-encoded; strip tags.
  const abstract = (w.abstract || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim() || null;
  return {
    doi,
    title,
    authors,
    journal,
    year: year ? Number(year) : null,
    abstract,
    url: w.URL || `https://doi.org/${doi}`,
  };
}

export default function AddPaperPage() {
  const [file, setFile] = useState<File | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [doi, setDoi] = useState("");
  const [meta, setMeta] = useState<Metadata | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editAuthors, setEditAuthors] = useState("");
  const [editJournal, setEditJournal] = useState("");
  const [editAbstract, setEditAbstract] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ paperId: string } | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const navigate = useNavigate();

  function applyMeta(m: Metadata) {
    setMeta(m);
    setEditTitle(m.title);
    setEditAuthors(m.authors.join(", "));
    setEditJournal(m.journal || "");
    setEditAbstract(m.abstract || "");
    setDoi(m.doi);
  }

  async function handleFile(f: File) {
    setError(null);
    setFile(f);
    if (f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) {
      setError("That doesn't look like a PDF.");
      return;
    }
    setExtracting(true);
    try {
      const extracted = await extractDoiFromPdf(f);
      if (extracted) {
        setDoi(extracted);
        const m = await lookupCrossref(extracted);
        if (m) applyMeta(m);
        else setError(`Found DOI ${extracted} but Crossref had no record. Edit manually below or paste a different DOI.`);
      } else {
        setError("Couldn't find a DOI in the first 3 pages. Paste it manually below.");
      }
    } catch (e: any) {
      setError(`Extraction failed: ${e.message}`);
    }
    setExtracting(false);
  }

  async function lookupManually() {
    const trimmed = doi.trim().replace(/^https?:\/\/doi\.org\//i, "");
    if (!trimmed) return;
    setExtracting(true);
    setError(null);
    try {
      const m = await lookupCrossref(trimmed);
      if (m) applyMeta(m);
      else setError("Crossref had no record for that DOI. You can still save manually.");
    } catch (e: any) {
      setError(`Lookup failed: ${e.message}`);
    }
    setExtracting(false);
  }

  async function save() {
    setError(null);
    if (!editTitle.trim()) {
      setError("Title is required.");
      return;
    }
    setSaving(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError("Not signed in.");
      setSaving(false);
      return;
    }

    // Use DOI as source_id when present (deduplicates against future
    // PubMed/RSS ingests of the same paper). Otherwise mint a stable
    // hash from title+year so the user can re-save without duplicating.
    const sourceId = doi.trim() || `manual:${editTitle.slice(0, 80).replace(/\s+/g, "_")}`;
    const authors = editAuthors.split(",").map((a) => a.trim()).filter(Boolean);
    const publishedAt = meta?.year ? `${meta.year}-01-01` : null;

    const paperRow = {
      user_id: user.id,
      source: "user_upload",
      source_id: sourceId,
      doi: doi.trim() || null,
      title: editTitle.trim(),
      authors,
      journal: editJournal.trim() || null,
      published_at: publishedAt,
      abstract: editAbstract.trim() || null,
      url: meta?.url || (doi ? `https://doi.org/${doi.trim()}` : ""),
      // No relevance_score, no summary — set on next pipeline run.
    };

    const { data: paperData, error: paperErr } = await supabase
      .from("papers")
      .upsert(paperRow, { onConflict: "user_id,source,source_id" })
      .select("id")
      .single();

    if (paperErr || !paperData) {
      setError(`Save failed: ${paperErr?.message || "no row returned"}`);
      setSaving(false);
      return;
    }

    const paperId = paperData.id;

    // Upload PDF if one was provided.
    if (file) {
      const key = `${user.id}/${paperId}.pdf`;
      const { error: upErr } = await supabase.storage
        .from("paper-pdfs")
        .upload(key, file, { contentType: "application/pdf", upsert: true });
      if (upErr) {
        setError(`Paper saved but PDF upload failed: ${upErr.message}`);
        setSaving(false);
        return;
      }
    }

    // Auto-pin so it shows up in Library immediately.
    await supabase
      .from("pins")
      .upsert(
        { user_id: user.id, paper_id: paperId },
        { onConflict: "user_id,paper_id" },
      );

    setSaving(false);
    setDone({ paperId });
  }

  function reset() {
    setFile(null);
    setDoi("");
    setMeta(null);
    setEditTitle("");
    setEditAuthors("");
    setEditJournal("");
    setEditAbstract("");
    setError(null);
    setDone(null);
  }

  if (done) {
    return (
      <div className="max-w-lg mx-auto px-6 pt-10 pb-32 space-y-5 text-center">
        <div className="text-6xl">📥</div>
        <h1 className="text-[28px] font-semibold text-text-primary leading-tight">
          Filed.
        </h1>
        <p className="font-serif text-[15px] text-text-secondary max-w-sm mx-auto">
          The paper is in your Library. The pipeline will embed it on the next
          run (~90 minutes) so it ranks against your other reading.
        </p>
        <div className="flex flex-col gap-2 max-w-xs mx-auto pt-2">
          <button
            onClick={() => navigate(`/paper/${done.paperId}`)}
            className="rounded-xl bg-jewel-emerald text-white font-semibold py-3 active:opacity-80"
          >
            Open paper
          </button>
          <button
            onClick={reset}
            className="rounded-xl bg-bg-card text-text-primary font-medium py-3 border border-stroke active:opacity-80"
          >
            Add another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-6 pt-10 pb-32 space-y-5">
      <div>
        <Link to="/library" className="text-jewel-emerald text-sm font-medium">‹ Library</Link>
      </div>
      <h1 className="text-[34px] font-semibold text-text-primary leading-tight">
        Add a paper
      </h1>
      <p className="font-serif text-[15px] text-text-secondary -mt-2">
        Drop a PDF you found elsewhere — we'll file it, look up the citation,
        and add it to your feed.
      </p>

      {/* Step 1: PDF picker */}
      <section
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const f = e.dataTransfer.files?.[0];
          if (f) handleFile(f);
        }}
        className="bg-bg-card rounded-2xl p-6 border-2 border-dashed border-stroke cursor-pointer hover:border-jewel-emerald transition text-center"
      >
        {file ? (
          <>
            <div className="text-2xl mb-1">📄</div>
            <div className="text-sm font-semibold text-text-primary line-clamp-1">{file.name}</div>
            <div className="text-caption text-text-secondary mt-0.5">
              {(file.size / 1024).toFixed(0)} KB · {extracting ? "Reading…" : "Tap to replace"}
            </div>
          </>
        ) : (
          <>
            <div className="text-3xl mb-2">⬆</div>
            <div className="text-sm font-semibold text-text-primary">
              Drop a PDF here, or tap to choose
            </div>
            <div className="text-caption text-text-secondary mt-0.5">
              We'll extract the DOI from the first page.
            </div>
          </>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = "";
          }}
        />
      </section>

      {/* Step 2: DOI manual entry / fallback */}
      <section className="bg-bg-card rounded-2xl p-4 space-y-3">
        <div className="text-eyebrow font-semibold text-text-secondary uppercase tracking-wider">
          DOI {meta ? "✓ found" : extracting ? "(searching…)" : "(or paste manually)"}
        </div>
        <div className="flex gap-2">
          <input
            value={doi}
            onChange={(e) => setDoi(e.target.value)}
            placeholder="10.1182/blood.2024023456"
            className="flex-1 rounded-xl bg-bg-primary px-3 py-2.5 text-sm font-mono text-text-primary placeholder:text-text-secondary/60 border border-transparent focus:border-jewel-emerald focus:outline-none"
          />
          <button
            onClick={lookupManually}
            disabled={extracting || !doi.trim()}
            className="px-4 rounded-xl bg-jewel-emerald text-white text-sm font-semibold disabled:opacity-50"
          >
            Look up
          </button>
        </div>
      </section>

      {error && (
        <div className="bg-red-50 text-red-700 rounded-xl p-3 text-sm">{error}</div>
      )}

      {/* Step 3: Edit + save */}
      {(meta || file) && (
        <section className="bg-bg-card rounded-2xl p-4 space-y-3">
          <div className="text-eyebrow font-semibold text-text-secondary uppercase tracking-wider">
            Confirm citation
          </div>
          <Field label="Title">
            <input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="w-full rounded-xl bg-bg-primary px-3 py-2.5 text-sm text-text-primary border border-transparent focus:border-jewel-emerald focus:outline-none"
            />
          </Field>
          <Field label="Authors (comma-separated, PubMed format)">
            <input
              value={editAuthors}
              onChange={(e) => setEditAuthors(e.target.value)}
              placeholder="Smith JA, Doe RB"
              className="w-full rounded-xl bg-bg-primary px-3 py-2.5 text-sm text-text-primary border border-transparent focus:border-jewel-emerald focus:outline-none"
            />
          </Field>
          <Field label="Journal">
            <input
              value={editJournal}
              onChange={(e) => setEditJournal(e.target.value)}
              className="w-full rounded-xl bg-bg-primary px-3 py-2.5 text-sm text-text-primary border border-transparent focus:border-jewel-emerald focus:outline-none"
            />
          </Field>
          <Field label="Abstract (the embedding uses this — paste it if Crossref missed it)">
            <textarea
              value={editAbstract}
              onChange={(e) => setEditAbstract(e.target.value)}
              rows={4}
              className="w-full rounded-xl bg-bg-primary px-3 py-2.5 text-sm text-text-primary border border-transparent focus:border-jewel-emerald focus:outline-none resize-none"
            />
          </Field>

          <button
            onClick={save}
            disabled={saving || !editTitle.trim()}
            className="w-full rounded-xl bg-jewel-emerald text-white font-semibold py-3 mt-2 disabled:opacity-50 active:opacity-80"
          >
            {saving ? "Filing…" : `${file ? "File PDF + " : ""}Save to Library`}
          </button>
        </section>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-caption text-text-secondary mb-1">{label}</div>
      {children}
    </div>
  );
}
