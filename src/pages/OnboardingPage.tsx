import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase, SUPABASE_URL } from "../lib/supabase";
import { JOURNAL_SETS, sortSetsByInterest } from "../lib/journalSets";

type Step = "welcome" | "interest" | "journals" | "authors" | "done";

const STEPS: Step[] = ["welcome", "interest", "journals", "authors", "done"];

export default function OnboardingPage() {
  const [step, setStep] = useState<Step>("welcome");
  const [interestText, setInterestText] = useState("");
  const [orcid, setOrcid] = useState("");
  const [orcidImporting, setOrcidImporting] = useState(false);
  const [presetId, setPresetId] = useState<string | null>(null);
  const [authors, setAuthors] = useState<string[]>(["", "", ""]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  // If they're already onboarded (came here by URL), skip to feed.
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("interest_text,suggested_journals")
        .maybeSingle();
      const hasInterest = !!(data?.interest_text || "").trim();
      const hasJournals = ((data?.suggested_journals as unknown[]) || []).length > 0;
      if (hasInterest && hasJournals) navigate("/", { replace: true });
    })();
  }, [navigate]);

  const stepIdx = STEPS.indexOf(step);

  async function importOrcid() {
    if (!orcid.trim()) return;
    setError(null);
    setOrcidImporting(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setError("Not signed in.");
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
      if (!res.ok) throw new Error(body.error || `Import failed (${res.status})`);
      setInterestText(
        (interestText ? interestText + " · " : "") +
        `Seeded from ORCID ${orcid} (${body.inserted} works)`,
      );
      // Move forward — ORCID alone is enough signal for interest.
      setStep("journals");
    } catch (e: any) {
      setError(e.message);
    }
    setOrcidImporting(false);
  }

  async function saveInterest() {
    setSaving(true);
    setError(null);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("Not signed in."); setSaving(false); return; }
    const { error: err } = await supabase
      .from("profiles")
      .update({ interest_text: interestText.trim() })
      .eq("user_id", user.id);
    setSaving(false);
    if (err) { setError(err.message); return; }
    setStep("journals");
  }

  async function saveJournals() {
    setSaving(true);
    setError(null);
    const set = JOURNAL_SETS.find((s) => s.id === presetId);
    if (!set) { setSaving(false); setStep("authors"); return; }
    const payload = set.journals.map((name) => ({ name }));
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("Not signed in."); setSaving(false); return; }
    const { error: err } = await supabase
      .from("profiles")
      .update({ suggested_journals: payload })
      .eq("user_id", user.id);
    setSaving(false);
    if (err) { setError(err.message); return; }
    setStep("authors");
  }

  async function saveAuthors() {
    setSaving(true);
    setError(null);
    const cleaned = authors.map((a) => a.trim()).filter(Boolean);
    if (cleaned.length > 0) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setError("Not signed in."); setSaving(false); return; }
      const rows = cleaned.map((value) => ({
        user_id: user.id,
        kind: "author" as const,
        value,
      }));
      const { error: err } = await supabase.from("topic_seeds").insert(rows);
      if (err) { setError(err.message); setSaving(false); return; }
    }
    setSaving(false);
    setStep("done");
  }

  function finish() {
    navigate("/", { replace: true });
  }

  return (
    <div className="max-w-lg mx-auto px-6 pt-10 pb-16 min-h-screen bg-bg-primary">
      {/* Progress dots — exclude welcome and done from the count */}
      <div className="flex items-center gap-2 mb-8">
        {STEPS.slice(1, -1).map((s, i) => (
          <div
            key={s}
            className={`h-1.5 flex-1 rounded-full transition ${
              stepIdx > i ? "bg-jewel-emerald" : stepIdx === i + 1 ? "bg-jewel-topaz" : "bg-bg-card"
            }`}
          />
        ))}
      </div>

      {error && (
        <div className="mb-4 text-sm text-red-600 bg-red-50 rounded-xl p-3">{error}</div>
      )}

      {step === "welcome" && (
        <div className="space-y-5">
          <div className="text-eyebrow font-semibold text-text-secondary uppercase tracking-wider">
            Welcome
          </div>
          <h1 className="text-[36px] font-semibold leading-tight text-text-primary">
            A research feed that listens — literally.
          </h1>
          <p className="font-serif text-[17px] leading-relaxed text-text-primary">
            Each morning, Literature Companion reads the new biomedical literature
            against your taste and assembles two things for you:
          </p>
          <ul className="space-y-3 font-serif text-[15px] text-text-primary">
            <li>
              <span className="text-jewel-emerald font-semibold">A ranked feed</span>
              {" "}— top journals first, then discovery picks the algorithm thinks you'd want.
            </li>
            <li>
              <span className="text-jewel-emerald font-semibold">A spoken briefing</span>
              {" "}— a 5–10 minute audio digest of today's papers, narrated in plain English.
            </li>
          </ul>
          <p className="text-caption text-text-secondary">
            Three quick questions and you're set. ~1 minute.
          </p>
          <button
            onClick={() => setStep("interest")}
            className="w-full rounded-xl bg-jewel-emerald text-white font-semibold py-3 text-base active:opacity-80"
          >
            Let's go →
          </button>
        </div>
      )}

      {step === "interest" && (
        <div className="space-y-5">
          <div className="text-eyebrow font-semibold text-text-secondary uppercase tracking-wider">
            Step 1 of 3 · Your research
          </div>
          <h2 className="text-[28px] font-semibold leading-tight text-text-primary">
            What do you work on?
          </h2>

          <section className="bg-bg-card rounded-2xl p-4 space-y-3">
            <div className="text-eyebrow font-semibold text-text-secondary uppercase tracking-wider">
              Fastest: import from ORCID
            </div>
            <p className="text-caption text-text-secondary">
              Seeds your taste with every paper you've published.
            </p>
            <div className="flex gap-2">
              <input
                value={orcid}
                onChange={(e) => setOrcid(e.target.value)}
                placeholder="0000-0000-0000-0000"
                className="flex-1 rounded-xl bg-bg-primary px-3 py-2.5 text-sm font-mono text-text-primary placeholder:text-text-secondary/60 border border-transparent focus:border-jewel-emerald focus:outline-none"
              />
              <button
                onClick={importOrcid}
                disabled={orcidImporting || !orcid.trim()}
                className="px-4 rounded-xl bg-jewel-emerald text-white text-sm font-semibold disabled:opacity-50"
              >
                {orcidImporting ? "Importing…" : "Import"}
              </button>
            </div>
          </section>

          <div className="text-center text-caption text-text-secondary">— or —</div>

          <section className="bg-bg-card rounded-2xl p-4 space-y-3">
            <div className="text-eyebrow font-semibold text-text-secondary uppercase tracking-wider">
              Describe your focus
            </div>
            <textarea
              value={interestText}
              onChange={(e) => setInterestText(e.target.value)}
              placeholder="e.g. T cell immune reconstitution after allogeneic HSCT, with a focus on chronic GVHD biomarkers"
              rows={4}
              className="w-full rounded-xl bg-bg-primary px-3 py-2.5 text-base text-text-primary placeholder:text-text-secondary/60 border border-transparent focus:border-jewel-emerald focus:outline-none resize-none"
            />
            <p className="text-caption text-text-secondary">
              A sentence or two. The pipeline embeds this and matches papers against it.
            </p>
          </section>

          <div className="flex gap-2">
            <button
              onClick={() => setStep("welcome")}
              className="flex-1 rounded-xl bg-bg-card text-text-secondary font-medium py-2.5 border border-stroke"
            >
              Back
            </button>
            <button
              onClick={saveInterest}
              disabled={saving || !interestText.trim()}
              className="flex-[2] rounded-xl bg-jewel-emerald text-white font-semibold py-2.5 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Continue →"}
            </button>
          </div>
        </div>
      )}

      {step === "journals" && (
        <div className="space-y-5">
          <div className="text-eyebrow font-semibold text-text-secondary uppercase tracking-wider">
            Step 2 of 3 · Journals
          </div>
          <h2 className="text-[28px] font-semibold leading-tight text-text-primary">
            Which journals do you read first?
          </h2>
          <p className="font-serif text-[15px] text-text-secondary">
            Pick the closest preset. You can fine-tune later in Settings.
          </p>
          <div className="space-y-2">
            {sortSetsByInterest(interestText).map((s) => {
              const active = presetId === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => setPresetId(s.id)}
                  className={`w-full text-left rounded-2xl p-4 border-2 transition ${
                    active
                      ? "bg-jewel-emerald/10 border-jewel-emerald"
                      : "bg-bg-card border-transparent hover:border-stroke"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className={`font-semibold ${active ? "text-jewel-emerald" : "text-text-primary"}`}>
                      {s.name}
                    </div>
                    {active && <span className="text-jewel-emerald">✓</span>}
                  </div>
                  <div className="text-caption text-text-secondary mt-0.5">
                    {s.description}
                  </div>
                  <div className="text-[11px] text-text-secondary/70 mt-1.5 line-clamp-1">
                    {s.journals.slice(0, 4).join(" · ")}
                    {s.journals.length > 4 && ` · +${s.journals.length - 4} more`}
                  </div>
                </button>
              );
            })}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setStep("interest")}
              className="flex-1 rounded-xl bg-bg-card text-text-secondary font-medium py-2.5 border border-stroke"
            >
              Back
            </button>
            <button
              onClick={saveJournals}
              disabled={saving || !presetId}
              className="flex-[2] rounded-xl bg-jewel-emerald text-white font-semibold py-2.5 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Continue →"}
            </button>
          </div>
        </div>
      )}

      {step === "authors" && (
        <div className="space-y-5">
          <div className="text-eyebrow font-semibold text-text-secondary uppercase tracking-wider">
            Step 3 of 3 · Authors
          </div>
          <h2 className="text-[28px] font-semibold leading-tight text-text-primary">
            Anyone whose papers you always read?
          </h2>
          <p className="font-serif text-[15px] text-text-secondary">
            Optional. PubMed format —{" "}
            <code className="bg-bg-card px-1.5 py-0.5 rounded text-[13px]">
              LastName Initials
            </code>
            . Every new paper they author or co-author surfaces in your feed.
          </p>
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <input
                key={i}
                value={authors[i]}
                onChange={(e) => {
                  const next = [...authors];
                  next[i] = e.target.value;
                  setAuthors(next);
                }}
                placeholder={
                  i === 0 ? "e.g. Hanash AM"
                  : i === 1 ? "e.g. DeWolf S"
                  : "Optional"
                }
                className="w-full rounded-xl bg-bg-card px-4 py-3 text-base text-text-primary placeholder:text-text-secondary/60 border border-transparent focus:border-jewel-emerald focus:outline-none"
              />
            ))}
          </div>
          <p className="text-caption text-text-secondary/70">
            Skip if none come to mind — you can add authors any time, including with one click from any paper page.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setStep("journals")}
              className="flex-1 rounded-xl bg-bg-card text-text-secondary font-medium py-2.5 border border-stroke"
            >
              Back
            </button>
            <button
              onClick={saveAuthors}
              disabled={saving}
              className="flex-[2] rounded-xl bg-jewel-emerald text-white font-semibold py-2.5 disabled:opacity-50"
            >
              {saving ? "Saving…" : authors.some((a) => a.trim()) ? "Finish →" : "Skip →"}
            </button>
          </div>
        </div>
      )}

      {step === "done" && (
        <div className="space-y-5 text-center pt-8">
          <div className="relative inline-block">
            <div className="text-6xl">🛠️</div>
            <span className="absolute -top-1 -right-2 inline-flex h-3 w-3 rounded-full bg-jewel-emerald animate-ping" />
          </div>
          <h2 className="text-[32px] font-semibold leading-tight text-text-primary">
            Building your first feed
          </h2>
          <p className="font-serif text-[16px] leading-relaxed text-text-primary max-w-sm mx-auto">
            The pipeline is reading PubMed and ranking papers against your
            interests. <span className="font-semibold">First feed in ~10–20 minutes.</span>
          </p>
          <p className="text-caption text-text-secondary max-w-xs mx-auto">
            After that, new papers ingest every 90 minutes and a fresh
            audio briefing lands every weekday at 5:30 AM your time.
          </p>
          <div className="pt-4">
            <button
              onClick={finish}
              className="w-full max-w-xs rounded-xl bg-jewel-emerald text-white font-semibold py-3 text-base active:opacity-80"
            >
              Open my feed
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
