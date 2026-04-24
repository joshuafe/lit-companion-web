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
