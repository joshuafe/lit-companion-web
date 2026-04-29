import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import type { Profile } from "../lib/types";

export default function SettingsPage() {
  const [email, setEmail] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setEmail(user?.email ?? null);
      const { data: p } = await supabase.from("profiles").select().maybeSingle();
      setProfile(p as Profile);
    })();
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <div className="max-w-lg mx-auto px-6 pt-10 space-y-4">
      <h1 className="text-[34px] font-semibold text-text-primary">Settings</h1>

      <section className="bg-bg-card rounded-2xl p-4">
        <div className="text-eyebrow font-semibold text-text-secondary uppercase tracking-wider">
          Account
        </div>
        <div className="mt-2 text-caption text-text-secondary">Signed in as</div>
        <div className="text-base text-text-primary">{email || "—"}</div>
        <button
          onClick={signOut}
          className="mt-3 text-accent font-medium text-sm"
        >
          Sign out
        </button>
      </section>

      {profile && (
        <section className="bg-bg-card rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <div className="text-eyebrow font-semibold text-text-secondary uppercase tracking-wider">
              Interests
            </div>
            <Link to="/settings/seeds" className="text-accent text-sm font-medium">
              Manage seeds →
            </Link>
          </div>
          <div className="mt-2 text-caption text-text-secondary">
            {profile.interest_text || "No seeds yet."}
          </div>
        </section>
      )}

      <section className="bg-bg-card rounded-2xl p-4">
        <div className="flex items-center justify-between">
          <div className="text-eyebrow font-semibold text-text-secondary uppercase tracking-wider">
            Preferred journals
          </div>
          <Link to="/settings/journals" className="text-jewel-emerald text-sm font-medium">
            Customize →
          </Link>
        </div>
        <div className="mt-2 text-caption text-text-secondary">
          {profile?.suggested_journals?.length
            ? `${profile.suggested_journals.length} selected`
            : "Pick a starting set."}
        </div>
      </section>

      <Link
        to="/constellation"
        className="block bg-gradient-to-br from-jewel-topaz/20 to-jewel-emerald/10 rounded-2xl p-4 border border-jewel-topaz/20 active:opacity-80"
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="text-eyebrow font-semibold text-jewel-topaz uppercase tracking-wider">
              ✦ Topic Constellation — prototype
            </div>
            <div className="text-sm text-text-primary mt-1 font-medium">
              See your reading as a star map
            </div>
            <div className="text-caption text-text-secondary mt-0.5">
              Tag clusters, bridge papers, surprise picks.
            </div>
          </div>
          <span className="text-jewel-topaz text-lg shrink-0">→</span>
        </div>
      </Link>

      <TimezoneCard />

      <ProxyTemplateCard />

      <section className="bg-bg-card rounded-2xl p-4">
        <div className="text-eyebrow font-semibold text-text-secondary uppercase tracking-wider">
          About
        </div>
        <p className="mt-2 text-caption text-text-secondary">
          Literature Companion · Alpha · PWA build
        </p>
        <p className="mt-1 text-caption text-text-secondary">
          Daily briefing pipeline runs on the host server overnight.
        </p>
      </section>
    </div>
  );
}

function TimezoneCard() {
  const [value, setValue] = useState<string>("");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [detected, setDetected] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Browser-detected IANA TZ — used as default and as the auto-fill
      // when the profile column is null.
      const browserTz =
        Intl.DateTimeFormat().resolvedOptions().timeZone || "";
      if (cancelled) return;
      setDetected(browserTz);

      const { data } = await supabase
        .from("profiles")
        .select("timezone")
        .maybeSingle();
      const stored = (data as any)?.timezone as string | null | undefined;
      if (cancelled) return;
      setValue(stored || browserTz);
      setLoaded(true);

      // First-time auto-save: if the column was null and the browser knows
      // a TZ, persist it without making the user click anything. Settings
      // still lets them override.
      if (!stored && browserTz) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase
            .from("profiles")
            .update({ timezone: browserTz })
            .eq("user_id", user.id);
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function save(next?: string) {
    const tz = (next ?? value).trim();
    if (!tz) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }
    const { error } = await supabase
      .from("profiles")
      .update({ timezone: tz })
      .eq("user_id", user.id);
    setSaving(false);
    setStatus(error ? `Error: ${error.message}` : "Saved.");
    setTimeout(() => setStatus(null), 2000);
  }

  if (!loaded) return null;

  // Common IANA zones — keep the list short and let users type a custom
  // value if theirs isn't here. Order: detected first, then a curated set.
  const COMMON: string[] = [
    "America/New_York",
    "America/Chicago",
    "America/Denver",
    "America/Los_Angeles",
    "America/Phoenix",
    "America/Anchorage",
    "Pacific/Honolulu",
    "Europe/London",
    "Europe/Paris",
    "Europe/Berlin",
    "Europe/Zurich",
    "Asia/Jerusalem",
    "Asia/Dubai",
    "Asia/Kolkata",
    "Asia/Singapore",
    "Asia/Tokyo",
    "Australia/Sydney",
    "UTC",
  ];
  const options = Array.from(new Set([detected, ...COMMON].filter(Boolean)));

  return (
    <section className="bg-bg-card rounded-2xl p-4">
      <div className="text-eyebrow font-semibold text-text-secondary uppercase tracking-wider">
        Timezone
      </div>
      <p className="mt-2 text-caption text-text-secondary">
        Your morning briefing renders at 5:30 in this timezone. We auto-detect
        from your browser; override here if you want to.
      </p>
      <div className="flex gap-2 mt-3 items-center">
        <select
          value={options.includes(value) ? value : "__custom__"}
          onChange={(e) => {
            if (e.target.value !== "__custom__") {
              setValue(e.target.value);
              save(e.target.value);
            }
          }}
          className="flex-1 rounded-xl bg-bg-primary px-3 py-2 text-sm text-text-primary border border-transparent focus:border-jewel-emerald focus:outline-none"
        >
          {options.map((tz) => (
            <option key={tz} value={tz}>
              {tz}{tz === detected ? " · detected" : ""}
            </option>
          ))}
          <option value="__custom__">Custom…</option>
        </select>
      </div>
      {!options.includes(value) && (
        <div className="flex gap-2 mt-2">
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Continent/City (e.g. America/New_York)"
            className="flex-1 rounded-xl bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary/60 border border-transparent focus:border-jewel-emerald focus:outline-none font-mono"
          />
          <button
            onClick={() => save()}
            disabled={saving}
            className="rounded-xl bg-jewel-emerald text-white text-sm font-semibold px-4 disabled:opacity-50"
          >
            {saving ? "…" : "Save"}
          </button>
        </div>
      )}
      {status && <div className="mt-2 text-caption text-text-secondary">{status}</div>}
    </section>
  );
}


function ProxyTemplateCard() {
  const [value, setValue] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("profiles").select("proxy_url_template").maybeSingle();
      setValue((data as any)?.proxy_url_template ?? "");
      setLoaded(true);
    })();
  }, []);

  async function save() {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }
    const v = value.trim() || null;
    const { error } = await supabase
      .from("profiles")
      .update({ proxy_url_template: v })
      .eq("user_id", user.id);
    setSaving(false);
    setStatus(error ? `Error: ${error.message}` : "Saved.");
    setTimeout(() => setStatus(null), 2000);
  }

  if (!loaded) return null;
  return (
    <section className="bg-bg-card rounded-2xl p-4">
      <div className="text-eyebrow font-semibold text-text-secondary uppercase tracking-wider">
        Institutional proxy
      </div>
      <p className="mt-2 text-caption text-text-secondary">
        Used by the "Open via my proxy" button on paywalled papers. Find your
        proxy URL on your library website (search "EZproxy" + your institution
        name). Use <code className="bg-bg-primary px-1 rounded">{`{url}`}</code> as
        a placeholder for the article URL, or omit it to append.
      </p>
      <div className="flex gap-2 mt-3">
        <input
          type="url"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="https://login.proxy.library.weill.cornell.edu/login?url={url}"
          className="flex-1 rounded-xl bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary/60 border border-transparent focus:border-jewel-emerald focus:outline-none"
        />
        <button
          onClick={save}
          disabled={saving}
          className="rounded-xl bg-jewel-emerald text-white text-sm font-semibold px-4 disabled:opacity-50"
        >
          {saving ? "…" : "Save"}
        </button>
      </div>
      {status && <div className="mt-2 text-caption text-text-secondary">{status}</div>}
    </section>
  );
}
