import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";

interface Seed {
  id: string;
  kind: "pmid" | "doi" | "title";
  value: string;
  created_at: string;
  processed_at: string | null;
}

export default function SeedsPage() {
  const [seeds, setSeeds] = useState<Seed[]>([]);
  const [loading, setLoading] = useState(true);
  const [kind, setKind] = useState<"pmid" | "doi" | "title">("pmid");
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data, error: err } = await supabase
      .from("topic_seeds")
      .select()
      .order("created_at", { ascending: false });
    if (err) setError(err.message);
    setSeeds((data as Seed[]) || []);
    setLoading(false);
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

      <form onSubmit={addSeed} className="bg-bg-card rounded-2xl p-4 space-y-3">
        <div className="flex gap-2">
          {(["pmid", "doi", "title"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider ${
                kind === k
                  ? "bg-accent text-white"
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
              : "e.g. immune reconstitution after HSCT"
          }
          className="w-full rounded-xl bg-bg-primary px-4 py-3 text-base text-text-primary placeholder:text-text-secondary/60 border border-transparent focus:border-accent focus:outline-none"
        />
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
