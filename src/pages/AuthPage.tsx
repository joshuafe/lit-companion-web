import { useState } from "react";
import { supabase } from "../lib/supabase";

export default function AuthPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    setLoading(false);
    if (error) setError(error.message);
    else setSent(true);
  }

  return (
    <div className="app-shell flex flex-col justify-center px-7 py-12 bg-bg-primary">
      <div className="max-w-md mx-auto w-full">
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
              }}
            >
              Send another link
            </button>
          </>
        ) : (
          <>
            <p className="mt-4 text-base text-text-secondary">
              Enter your email. We'll send a one-time link to sign you in.
            </p>

            <form onSubmit={sendLink} className="mt-6 space-y-3">
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
              <button
                type="submit"
                disabled={loading || !email}
                className="w-full rounded-xl bg-accent text-white font-semibold py-3 disabled:opacity-50 active:opacity-80"
              >
                {loading ? "Sending…" : "Send magic link"}
              </button>
            </form>
          </>
        )}

        {error && (
          <div className="mt-4 text-sm text-red-600">{error}</div>
        )}
      </div>
    </div>
  );
}
