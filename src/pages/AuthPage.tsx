import { useState } from "react";
import { supabase, SUPABASE_URL } from "../lib/supabase";

type Mode = "magic" | "password";

export default function AuthPage() {
  const [mode, setMode] = useState<Mode>("magic");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Atomically validates the invite code for this email. On success the
   * email is added to invite_redemptions; the auth.users INSERT trigger
   * will then admit any sign-up from this address (magic link OR Google).
   * Idempotent — a second redeem with the same email returns the original
   * code, so existing/grandfathered users still pass.
   */
  async function redeemInvite(email: string, code: string): Promise<string | null> {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/redeem-invite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return body.error || `invite check failed (${res.status})`;
    return null;
  }

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const inviteErr = await redeemInvite(email, code);
    if (inviteErr) {
      setError(inviteErr);
      setLoading(false);
      return;
    }
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    setLoading(false);
    if (error) setError(error.message);
    else setSent(true);
  }

  async function passwordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    // Try sign-in first. If the user doesn't exist, fall through to sign-up
    // (which requires the invite code). This makes the same form work for
    // both new and returning users.
    const signIn = await supabase.auth.signInWithPassword({ email, password });
    if (!signIn.error) {
      setLoading(false);
      return;
    }
    // Sign-up path — invite code required.
    const inviteErr = await redeemInvite(email, code);
    if (inviteErr) {
      setError(inviteErr);
      setLoading(false);
      return;
    }
    const signUp = await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (signUp.error) {
      setError(signUp.error.message);
    }
  }

  async function signInWithGoogle() {
    setError(null);
    if (!email || !code) {
      setError("Enter email + invite code first — Google sign-in still needs them.");
      return;
    }
    const inviteErr = await redeemInvite(email, code);
    if (inviteErr) {
      setError(inviteErr);
      return;
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) setError(error.message);
  }

  return (
    <div className="app-shell flex flex-col justify-center px-7 py-12 bg-bg-primary">
      <div className="max-w-md mx-auto w-full">
        <img
          src="/logo.svg"
          alt="Literature Companion"
          className="w-24 h-24 mb-4 rounded-2xl shadow-sm"
        />
        <div className="text-accent text-eyebrow font-semibold uppercase tracking-wider">
          Literature Companion
        </div>

        <h1 className="mt-4 text-[34px] leading-tight font-semibold text-text-primary">
          {sent
            ? "Check your inbox."
            : "Your briefing,\nshaped by your taste."}
        </h1>

        {sent ? (
          <>
            <p className="mt-4 text-base text-text-secondary">
              We sent a one-time link to <strong>{email}</strong>. Open it on
              this device — it'll bring you right back here, signed in.
            </p>
            <button
              className="mt-6 text-accent font-medium text-sm"
              onClick={() => {
                setSent(false);
                setEmail("");
                setCode("");
              }}
            >
              Send another link
            </button>
          </>
        ) : (
          <>
            <p className="mt-4 text-base text-text-secondary">
              Alpha access is invite-only. Sign-up needs a code; sign-in
              with an existing account just needs your password.
            </p>

            {/* Mode toggle */}
            <div className="mt-5 inline-flex bg-bg-card rounded-full p-0.5 text-[12px] font-semibold">
              <button
                type="button"
                onClick={() => setMode("magic")}
                className={`px-3 py-1.5 rounded-full ${mode === "magic" ? "bg-accent text-white" : "text-text-secondary"}`}
              >
                Magic link
              </button>
              <button
                type="button"
                onClick={() => setMode("password")}
                className={`px-3 py-1.5 rounded-full ${mode === "password" ? "bg-accent text-white" : "text-text-secondary"}`}
              >
                Password
              </button>
            </div>

            <form
              onSubmit={mode === "magic" ? sendLink : passwordSubmit}
              className="mt-4 space-y-3"
            >
              <input
                type="text"
                autoCapitalize="characters"
                placeholder="Invite code (sign-up only)"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="w-full rounded-xl bg-bg-card px-4 py-3 text-base text-text-primary placeholder:text-text-secondary/60 border border-transparent focus:border-accent focus:outline-none tracking-wider font-mono"
              />
              <input
                type="email"
                autoComplete="email"
                inputMode="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-xl bg-bg-card px-4 py-3 text-base text-text-primary placeholder:text-text-secondary/60 border border-transparent focus:border-accent focus:outline-none"
              />
              {mode === "password" && (
                <input
                  type="password"
                  autoComplete="current-password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full rounded-xl bg-bg-card px-4 py-3 text-base text-text-primary placeholder:text-text-secondary/60 border border-transparent focus:border-accent focus:outline-none"
                />
              )}
              <button
                type="submit"
                disabled={
                  loading ||
                  !email ||
                  (mode === "password" && password.length < 6) ||
                  (mode === "magic" && !code)
                }
                className="w-full rounded-xl bg-accent text-white font-semibold py-3 disabled:opacity-50 active:opacity-80"
              >
                {loading
                  ? mode === "magic" ? "Sending…" : "Signing in…"
                  : mode === "magic" ? "Send magic link" : "Sign in / sign up"}
              </button>
            </form>

            <div className="mt-5 flex items-center gap-3">
              <div className="flex-1 h-px bg-text-secondary/20" />
              <span className="text-caption text-text-secondary">or</span>
              <div className="flex-1 h-px bg-text-secondary/20" />
            </div>

            <button
              type="button"
              onClick={signInWithGoogle}
              className="mt-4 w-full rounded-xl bg-bg-card border border-stroke text-text-primary font-semibold py-3 active:opacity-80 flex items-center justify-center gap-3"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.79 2.72v2.26h2.9c1.7-1.57 2.69-3.88 2.69-6.62z"/>
                <path fill="#34A853" d="M9 18c2.43 0 4.47-.81 5.96-2.18l-2.9-2.26c-.81.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.96v2.34A8.99 8.99 0 0 0 9 18z"/>
                <path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 0 1 3.66 9c0-.59.1-1.16.29-1.7V4.96H.96A8.99 8.99 0 0 0 0 9c0 1.45.35 2.82.96 4.04l2.99-2.34z"/>
                <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A8.99 8.99 0 0 0 9 0 8.99 8.99 0 0 0 .96 4.96l2.99 2.34C4.66 5.17 6.65 3.58 9 3.58z"/>
              </svg>
              Continue with Google
            </button>

          </>
        )}

        {error && (
          <div className="mt-4 text-sm text-red-600">{error}</div>
        )}
      </div>
    </div>
  );
}
