import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase, SUPABASE_URL } from "../lib/supabase";

interface TocItem {
  title: string;
  link: string | null;
  pub_date: string | null;
  authors: string[];
  abstract: string | null;
  doi: string | null;
}

interface TocResponse {
  journal: string;
  feed_url: string;
  fetched_at: string;
  count: number;
  items: TocItem[];
}

function fmtDate(s: string | null): string {
  if (!s) return "";
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  const now = Date.now();
  const days = Math.floor((now - d.getTime()) / 86_400_000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 14) return `${days}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function strip(s: string | null | undefined): string {
  if (!s) return "";
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export default function TocPage() {
  const [params, setParams] = useSearchParams();
  const journal = params.get("journal");
  const [preferredJournals, setPreferredJournals] = useState<string[]>([]);
  const [data, setData] = useState<TocResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("suggested_journals")
        .maybeSingle();
      const raw = (profile?.suggested_journals as { name: string }[] | string[]) || [];
      const names = raw.map((x: any) => typeof x === "string" ? x : x.name).filter(Boolean);
      setPreferredJournals(names);
      if (!journal && names.length > 0) {
        setParams({ journal: names[0] }, { replace: true });
      }
    })();
  }, []);

  useEffect(() => {
    if (!journal) return;
    (async () => {
      setLoading(true);
      setError(null);
      setData(null);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError("Not signed in");
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(
          `${SUPABASE_URL}/functions/v1/journal-toc?journal=${encodeURIComponent(journal)}`,
          { headers: { Authorization: `Bearer ${session.access_token}` } },
        );
        const body = await res.json();
        if (!res.ok) {
          setError(body.message || body.error || `Fetch failed (${res.status})`);
          if (body.error === "no_feed_url") {
            setError(`We don't have an RSS URL registered for ${journal} yet. Drop me a note and I'll add it — pipeline still ingests it via PubMed.`);
          }
        } else {
          setData(body as TocResponse);
        }
      } catch (e: any) {
        setError(e.message);
      }
      setLoading(false);
    })();
  }, [journal]);

  return (
    <div className="max-w-lg mx-auto px-5 pt-10 pb-32">
      <div className="flex items-center gap-3 mb-2">
        <Link to="/latest" className="text-jewel-emerald text-sm font-medium">
          ‹ Latest
        </Link>
        <span className="text-eyebrow font-semibold text-text-secondary uppercase tracking-wider">
          Live RSS · table of contents
        </span>
      </div>
      <h1 className="text-[34px] font-semibold text-text-primary leading-tight">
        {journal || "Pick a journal"}
      </h1>
      {data && (
        <p className="text-caption text-text-secondary mt-1">
          {data.count} items · pulled live from{" "}
          <a
            href={data.feed_url}
            target="_blank" rel="noreferrer"
            className="underline decoration-text-secondary/30 hover:text-text-primary"
          >
            publisher RSS
          </a>{" "}
          · {fmtDate(data.fetched_at)}
        </p>
      )}

      {/* Journal picker chips — only your preferred journals */}
      {preferredJournals.length > 0 && (
        <div className="mt-4 flex gap-1.5 flex-wrap">
          {preferredJournals.map((j) => (
            <button
              key={j}
              onClick={() => setParams({ journal: j })}
              className={`text-[11px] font-semibold px-2.5 py-1 rounded-full transition ${
                journal === j
                  ? "bg-jewel-emerald text-white"
                  : "bg-bg-card text-text-secondary border border-stroke hover:border-jewel-emerald"
              }`}
            >
              {j}
            </button>
          ))}
        </div>
      )}

      {error && (
        <div className="mt-6 bg-red-50 text-red-700 rounded-xl p-3 text-sm">
          {error}
        </div>
      )}

      {loading && (
        <div className="mt-8 text-center text-caption text-text-secondary">
          Pulling live feed…
        </div>
      )}

      {data && data.items.length > 0 && (
        <ul className="mt-6 space-y-2">
          {data.items.map((item, i) => (
            <li key={i}>
              <a
                href={item.link || "#"}
                target="_blank"
                rel="noreferrer"
                className="block bg-bg-card rounded-card p-3 active:opacity-80 hover:border-jewel-emerald/30 border border-transparent transition"
              >
                <div className="flex items-baseline justify-between gap-2 mb-1">
                  <span className="text-eyebrow font-semibold text-text-secondary uppercase tracking-wider line-clamp-1">
                    {item.doi ? "doi" : "rss"}
                  </span>
                  <span className="text-[10px] font-mono text-text-secondary/70 shrink-0">
                    {fmtDate(item.pub_date)}
                  </span>
                </div>
                <div className="font-serif text-[15px] leading-snug text-text-primary line-clamp-3">
                  {strip(item.title)}
                </div>
                {item.authors.length > 0 && (
                  <div className="mt-1 text-caption text-text-secondary line-clamp-1">
                    {item.authors.slice(0, 4).join(", ")}
                    {item.authors.length > 4 ? ", et al." : ""}
                  </div>
                )}
                {item.abstract && (
                  <p className="mt-1.5 text-caption text-text-secondary/80 line-clamp-2">
                    {strip(item.abstract)}
                  </p>
                )}
              </a>
            </li>
          ))}
        </ul>
      )}

      {!loading && !error && !data && journal && (
        <div className="mt-8 text-center text-caption text-text-secondary">
          Loading RSS for {journal}…
        </div>
      )}

      {!journal && preferredJournals.length === 0 && (
        <div className="mt-8 bg-bg-card rounded-2xl p-4 text-caption text-text-secondary">
          No preferred journals yet.{" "}
          <Link to="/settings/journals" className="text-jewel-emerald font-medium">
            Pick a starting set →
          </Link>
        </div>
      )}
    </div>
  );
}
