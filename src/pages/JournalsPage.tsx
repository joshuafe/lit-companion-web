import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { ALL_KNOWN_JOURNALS, JOURNAL_SETS } from "../lib/journalSets";

type JournalEntry = { name: string };

export default function JournalsPage() {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [customName, setCustomName] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("suggested_journals")
        .maybeSingle();
      const raw = (data?.suggested_journals as JournalEntry[] | string[]) ?? [];
      const names = raw.map((x) => (typeof x === "string" ? x : x.name));
      setSelected(new Set(names));
      setLoading(false);
    })();
  }, []);

  function toggle(name: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function applyPreset(presetJournals: string[]) {
    setSelected(new Set(presetJournals));
    setStatus("Preset applied — remember to save.");
  }

  function addCustom() {
    const n = customName.trim();
    if (!n) return;
    setSelected((prev) => new Set(prev).add(n));
    setCustomName("");
  }

  async function save() {
    setSaving(true);
    setStatus(null);
    const payload = Array.from(selected).map((name) => ({ name }));
    const { error } = await supabase
      .from("profiles")
      .update({ suggested_journals: payload })
      .eq("user_id", (await supabase.auth.getUser()).data.user?.id);
    setSaving(false);
    setStatus(error ? `Error: ${error.message}` : "Saved.");
  }

  // "All journals" list = union of preset list + anything the user added that
  // isn't already in the known list. Alphabetized.
  const allJournals = useMemo(() => {
    const base = new Set(ALL_KNOWN_JOURNALS);
    for (const s of selected) base.add(s);
    return Array.from(base).sort((a, b) => a.localeCompare(b));
  }, [selected]);

  return (
    <div className="max-w-lg mx-auto px-6 pt-10 pb-32 space-y-5">
      <div>
        <Link to="/settings" className="text-accent text-sm font-medium">
          ← Settings
        </Link>
      </div>

      <h1 className="text-[34px] font-semibold text-text-primary">
        Preferred journals
      </h1>
      <p className="text-caption text-text-secondary -mt-2">
        Shape what the feed prioritizes. Start from a preset, then customize.
      </p>

      <section>
        <div className="text-eyebrow font-semibold text-text-secondary uppercase tracking-wider mb-2">
          Starting sets
        </div>
        <div className="grid grid-cols-1 gap-2">
          {JOURNAL_SETS.map((s) => (
            <button
              key={s.id}
              onClick={() => applyPreset(s.journals)}
              className="bg-bg-card rounded-2xl p-3 text-left active:opacity-80"
            >
              <div className="text-sm font-semibold text-text-primary">
                {s.name}
              </div>
              <div className="text-caption text-text-secondary mt-0.5">
                {s.description}
              </div>
              <div className="text-caption text-text-secondary/70 mt-1">
                {s.journals.slice(0, 4).join(" · ")}
                {s.journals.length > 4 ? ` · +${s.journals.length - 4}` : ""}
              </div>
            </button>
          ))}
        </div>
      </section>

      <section>
        <div className="text-eyebrow font-semibold text-text-secondary uppercase tracking-wider mb-2">
          Your list ({selected.size})
        </div>
        <ul className="bg-bg-card rounded-2xl divide-y divide-stroke">
          {allJournals.map((j) => {
            const on = selected.has(j);
            return (
              <li key={j}>
                <button
                  onClick={() => toggle(j)}
                  className="w-full flex items-center justify-between px-3 py-2.5 text-left"
                >
                  <span
                    className={`text-sm ${
                      on ? "text-text-primary font-medium" : "text-text-secondary"
                    }`}
                  >
                    {j}
                  </span>
                  <span
                    className={`w-5 h-5 rounded-full border ${
                      on
                        ? "bg-accent border-accent text-white flex items-center justify-center text-[11px]"
                        : "border-stroke"
                    }`}
                  >
                    {on ? "✓" : ""}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <div className="flex gap-2 mt-3">
          <input
            type="text"
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            placeholder="Add another journal (e.g. Haematologica)"
            className="flex-1 rounded-xl bg-bg-card px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary/60 border border-transparent focus:border-accent focus:outline-none"
          />
          <button
            onClick={addCustom}
            disabled={!customName.trim()}
            className="px-4 rounded-xl bg-accent text-white text-sm font-semibold disabled:opacity-50"
          >
            Add
          </button>
        </div>
        <div className="text-caption text-text-secondary/70 mt-1">
          Journals without a known RSS feed fall back to PubMed by-journal search.
        </div>
      </section>

      <div className="fixed bottom-20 inset-x-0 px-6">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          {status && (
            <span className="text-caption text-text-secondary truncate">
              {status}
            </span>
          )}
          <button
            onClick={save}
            disabled={saving || loading}
            className="ml-auto rounded-xl bg-accent text-white font-semibold px-5 py-2.5 disabled:opacity-50 shadow-lg"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
