import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

// Public route. The Supabase password-recovery email links here with a
// recovery token in the URL hash (#access_token=…&type=recovery&…).
// supabase-js's auth state listener fires PASSWORD_RECOVERY when the SDK
// sees that hash; until then we don't know whether the user is in a real
// recovery session.

export default function ResetPasswordPage() {
  const [stage, setStage] = useState<"loading" | "ready" | "saving" | "saved" | "no_session" | "error">("loading");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    let resolved = false;

    // Listener catches the PASSWORD_RECOVERY event the SDK fires when the
    // recovery link's URL fragment is parsed.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" && session) {
        resolved = true;
        setStage("ready");
      }
    });

    // Fallback: if the page was already mounted with a session present
    // (e.g. user re-navigated), let them set a new password too.
    supabase.auth.getSession().then(({ data }) => {
      if (resolved) return;
      if (data.session) {
        setStage("ready");
      } else {
        // No recovery hash, no session. Probably someone hit /reset-password
        // directly without an email link.
        setTimeout(() => {
          if (!resolved) setStage("no_session");
        }, 800);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setErrMsg("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setErrMsg("Passwords don't match.");
      return;
    }
    setErrMsg(null);
    setStage("saving");
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setErrMsg(error.message);
      setStage("ready");
      return;
    }
    setStage("saved");
    // Brief celebration, then drop them at the app's home (which the
    // App.tsx router will resolve to /welcome or / depending on
    // onboarding state).
    setTimeout(() => navigate("/", { replace: true }), 1200);
  }

  return (
    <div className="bg-bg-primary min-h-screen flex items-center justify-center px-6 py-12">
      <div className="max-w-md w-full bg-bg-card rounded-3xl shadow-lg p-8">
        <Link to="/" className="flex items-center gap-2 mb-6">
          <img src="/logo.svg" alt="" className="w-8 h-8 rounded-lg" />
          <span className="font-serif text-[16px] font-semibold tracking-tight">
            Literature Companion
          </span>
        </Link>

        {stage === "loading" && (
          <p className="text-caption text-text-secondary">Verifying recovery link…</p>
        )}

        {stage === "no_session" && (
          <>
            <h1 className="font-serif text-[26px] font-semibold mb-3">Recovery link expired</h1>
            <p className="font-serif text-[15px] text-text-primary/85 leading-relaxed mb-5">
              This page only works when you arrive via the link in a password-reset email. The link may have already been used or expired.
            </p>
            <Link
              to="/"
              className="inline-block rounded-full bg-jewel-emerald text-white font-semibold px-5 py-2.5 text-sm"
            >
              Back to sign in →
            </Link>
          </>
        )}

        {(stage === "ready" || stage === "saving") && (
          <>
            <div className="text-eyebrow font-semibold text-jewel-emerald uppercase tracking-wider mb-2">
              Set your password
            </div>
            <h1 className="font-serif text-[26px] font-semibold leading-tight mb-4">
              Pick something only you'd guess.
            </h1>
            <p className="text-caption text-text-secondary mb-5">
              At least 8 characters. We'll remember you across the app.
            </p>
            <form onSubmit={submit} className="space-y-3">
              <input
                type="password"
                autoComplete="new-password"
                placeholder="New password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
                className="w-full rounded-xl bg-bg-primary px-4 py-3 text-base text-text-primary placeholder:text-text-secondary/60 border border-transparent focus:border-jewel-emerald focus:outline-none"
              />
              <input
                type="password"
                autoComplete="new-password"
                placeholder="Confirm password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                minLength={8}
                required
                className="w-full rounded-xl bg-bg-primary px-4 py-3 text-base text-text-primary placeholder:text-text-secondary/60 border border-transparent focus:border-jewel-emerald focus:outline-none"
              />
              <button
                type="submit"
                disabled={stage === "saving" || password.length < 8 || password !== confirm}
                className="w-full rounded-xl bg-jewel-emerald text-white font-semibold py-3 disabled:opacity-50 active:opacity-80"
              >
                {stage === "saving" ? "Saving…" : "Save password"}
              </button>
              {errMsg && <div className="text-sm text-red-600">{errMsg}</div>}
            </form>
          </>
        )}

        {stage === "saved" && (
          <>
            <div className="text-eyebrow font-semibold text-jewel-emerald uppercase tracking-wider mb-2">
              ✓ Saved
            </div>
            <h1 className="font-serif text-[26px] font-semibold mb-3">You're in.</h1>
            <p className="text-caption text-text-secondary">Taking you to the app…</p>
          </>
        )}

        {stage === "error" && (
          <>
            <h1 className="font-serif text-[24px] font-semibold mb-3">Something went wrong</h1>
            <p className="text-caption text-text-secondary mb-4">{errMsg}</p>
            <Link to="/" className="text-jewel-emerald font-semibold text-sm">Back to sign in →</Link>
          </>
        )}
      </div>
    </div>
  );
}
