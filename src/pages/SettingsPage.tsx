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
