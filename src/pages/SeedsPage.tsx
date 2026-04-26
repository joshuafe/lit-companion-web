import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase, SUPABASE_URL } from "../lib/supabase";

interface Seed {
  id: string;
  kind: "pmid" | "doi" | "title" | "author";
  value: string;
  created_at: string;
  processed_at: string | null;
}

export default function SeedsPage() {
  const [seeds, setSeeds] = useState<Seed[]>([]);
  const [loading, setLoading] = useState(true);
  const [kind, setKind] = useState<"pmid" | "doi" | "title" | "author">("pmid");
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orcid, setOrcid] = useState("");
  const [orcidImporting, setOrcidImporting] = useState(false);
  const [orcidStatus, setOrcidStatus] = useState<string | null>(null);
  const [suggestedAuthors, setSuggestedAuthors] = useState<{ name: string; pinCount: number }[]>([]);

  async function importFromOrcid() {
    setOrcidStatus(null);
    setError(null);
    if (!orcid.trim()) return;
    setOrcidImporting(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setError("Not signed in");
      setOrcidImporting(false);
      return;
    }
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/seed-from-orcid`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ orcid }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error || `Import failed (${res.status})`);
      } else {
        setOrcidStatus(
          body.inserted > 0
            ? `✓ Imported ${body.inserted} works from your ORCID profile.`
            : body.message || "No new works to import.",
        );
        setOrcid("");
        load();
      }
    } catch (e: any) {
      setError(e.message);
    }
    setOrcidImporting(false);
  }

  async function load() {
    setLoading(true);
    const [{ data, error: err }, { data: pinRows }] = await Promise.all([
      supabase
        .from("topic_seeds")
        .select()
        .order("created_at", { ascending: false }),
      // Pull the user's pinned papers' authors so we can suggest the most
      // implicitly endorsed PIs as one-click follows.
      supabase
        .from("pins")
        .select("papers(authors)")
        .limit(200),
    ]);
    if (err) setError(err.message);
    const seedRows = (data as Seed[]) || [];
    setSeeds(seedRows);

    // Tally last-author (PI) appearances across pinned papers; surface only
    // those the user hasn't already explicitly followed.
    const alreadyFollowed = new Set(
      seedRows.filter((s) => s.kind === "author").map((s) => s.value),
    );
    const counts = new Map<string, number>();
    for (const row of (pinRows as any[]) || []) {
      // PostgREST returns the joined `papers` row as either an object
      // (single FK) or array depending on the relationship; tolerate both.
      const paper = Array.isArray(row?.papers) ? row.papers[0] : row?.papers;
      const authors: string[] | null = paper?.authors || null;
      if (!authors?.length) continue;
      const senior = authors[authors.length - 1];
      if (!senior) continue;
      counts.set(senior, (counts.get(senior) || 0) + 1);
    }
    const suggestions = Array.from(counts.entries())
      .filter(([name, n]) => n >= 2 && !alreadyFollowed.has(name))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, pinCount]) => ({ name, pinCount }));
    setSuggestedAuthors(suggestions);

    setLoading(false);
  }

  async function followSuggestedAuthor(name: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error: err } = await supabase
      .from("topic_seeds")
      .insert({ user_id: user.id, kind: "author", value: name });
    if (err) {
      setError(err.message);
      return;
    }
    setSuggestedAuthors((s) => s.filter((a) => a.name !== name));
    load();
  }

  useEffect(() => {
    load();
  }, []);

  async function addSeed(e: React.FormEvent) {
    e.preventDefault();
    const v = value.trim();
    if (!v) return;
    setSubmitting(true);
    setError(null);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError("Not signed in");
      setSubmitting(false);
      return;
    }
    const { error: err } = await supabase
      .from("topic_seeds")
      .insert({ user_id: user.id, kind, value: v });
    setSubmitting(false);
    if (err) {
      setError(err.message);
      return;
    }
    setValue("");
    load();
  }

  async function removeSeed(id: string) {
    const { error: err } = await supabase
      .from("topic_seeds")
      .delete()
      .eq("id", id);
    if (err) {
      setError(err.message);
      return;
    }
    setSeeds((s) => s.filter((x) => x.id !== id));
  }

  const pending = seeds.filter((s) => !s.processed_at).length;

  return (
    <div className="max-w-lg mx-auto px-6 pt-10 pb-8 space-y-4">
      <div className="flex items-center gap-3">
        <Link to="/settings" className="text-accent text-sm font-medium">
          ← Settings
        </Link>
      </div>
      <h1 className="text-[34px] font-semibold text-text-primary">Your seeds</h1>
      <p className="text-caption text-text-secondary -mt-2">
        Papers that shape your taste. Add PMIDs, DOIs, or topic phrases — your
        Mac will re-embed within a few minutes.
      </p>

      {/* Import from profile */}
      <section className="bg-bg-card rounded-2xl p-4 space-y-3">
        <div className="text-eyebrow font-semibold text-text-secondary uppercase tracking-wider">
          Import from your profile
        </div>
        <p className="text-caption text-text-secondary">
          Pull your published works directly. Fastest way to seed.
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={orcid}
            onChange={(e) => setOrcid(e.target.value)}
            placeholder="ORCID iD (0000-0000-0000-0000)"
            className="flex-1 rounded-xl bg-bg-primary px-3 py-2.5 text-sm text-text-primary placeholder:text-text-secondary/60 border border-transparent focus:border-accent focus:outline-none font-mono"
          />
          <button
            onClick={importFromOrcid}
            disabled={orcidImporting || !orcid.trim()}
            className="px-4 rounded-xl bg-accent text-white text-sm font-semibold disabled:opacity-50 active:opacity-80"
          >
            {orcidImporting ? "Importing…" : "Import"}
          </button>
        </div>
        {orcidStatus && (
          <div className="text-caption text-jewel-emerald">{orcidStatus}</div>
        )}
        <div className="text-caption text-text-secondary/70 pt-1">
          Google Scholar import — coming soon. (No public API; we'll wire
          this through a server-side scraper next week.)
        </div>
      </section>

      {suggestedAuthors.length > 0 && (
        <section className="bg-bg-card rounded-2xl p-4 space-y-3">
          <div className="text-eyebrow font-semibold text-text-secondary uppercase tracking-wider">
            Authors you keep saving
          </div>
          <p className="text-caption text-text-secondary">
            Senior authors of your pinned papers. Tap to follow and surface every new paper they put out.
          </p>
          <div className="flex flex-wrap gap-2">
            {suggestedAuthors.map(({ name, pinCount }) => (
              <button
                key={name}
                onClick={() => followSuggestedAuthor(name)}
                className="text-[12px] font-semibold px-3 py-1.5 rounded-full bg-bg-primary text-text-primary border border-stroke hover:border-jewel-emerald hover:text-jewel-emerald transition"
                title={`${pinCount} pinned papers list ${name} as senior author`}
              >
                + {name}
                <span className="ml-1.5 text-text-secondary/70 text-[10px]">
                  ({pinCount} pins)
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      <form onSubmit={addSeed} className="bg-bg-card rounded-2xl p-4 space-y-3">
        <div className="flex gap-2 flex-wrap">
          {(["pmid", "doi", "title", "author"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider ${
                kind === k
                  ? "bg-jewel-emerald text-white"
                  : "bg-bg-primary text-text-secondary"
              }`}
            >
              {k}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={
            kind === "pmid"
              ? "e.g. 39123456"
              : kind === "doi"
              ? "e.g. 10.1182/bloodadvances.2024012345"
              : kind === "author"
              ? "e.g. Levine RL  — every new paper by them surfaces"
              : "e.g. immune reconstitution after HSCT"
          }
          className="w-full rounded-xl bg-bg-primary px-4 py-3 text-base text-text-primary placeholder:text-text-secondary/60 border border-transparent focus:border-jewel-emerald focus:outline-none"
        />
        {kind === "author" && (
          <p className="text-caption text-text-secondary">
            Use PubMed format: <code className="bg-bg-primary px-1 rounded">LastName Initials</code>
            {" "}— e.g. <code className="bg-bg-primary px-1 rounded">Hanash AM</code>,{" "}
            <code className="bg-bg-primary px-1 rounded">DeWolf S</code>. We surface every new paper they author or co-author.
          </p>
        )}
        <button
          type="submit"
          disabled={submitting || !value.trim()}
          className="w-full rounded-xl bg-accent text-white font-semibold py-2.5 disabled:opacity-50 active:opacity-80"
        >
          {submitting ? "Adding…" : "Add seed"}
        </button>
      </form>

      {error && <div className="text-sm text-red-600">{error}</div>}

      {pending > 0 && (
        <div className="text-caption text-text-secondary">
          {pending} seed{pending === 1 ? "" : "s"} waiting for next Mac sync.
        </div>
      )}

      {loading ? (
        <div className="text-caption text-text-secondary">Loading…</div>
      ) : seeds.length === 0 ? (
        <div className="text-caption text-text-secondary">No seeds yet.</div>
      ) : (
        <ul className="space-y-2">
          {seeds.map((s) => (
            <li
              key={s.id}
              className="bg-bg-card rounded-2xl p-3 flex items-start justify-between gap-3"
            >
              <div className="min-w-0">
                <div className="text-eyebrow font-semibold text-text-secondary uppercase tracking-wider">
                  {s.kind}
                  {s.processed_at ? (
                    <span className="ml-2 text-[10px] text-relevance-high normal-case tracking-normal">
                      ● embedded
                    </span>
                  ) : (
                    <span className="ml-2 text-[10px] text-accent normal-case tracking-normal">
                      ○ pending
                    </span>
                  )}
                </div>
                <div className="text-sm text-text-primary break-all mt-1">
                  {s.value}
                </div>
              </div>
              <button
                onClick={() => removeSeed(s.id)}
                className="text-caption text-text-secondary hover:text-red-600 shrink-0"
                aria-label="Remove seed"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
