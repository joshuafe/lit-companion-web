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
  // Waitlist form state — separate from sign-in to avoid sharing one
  // email field with two semantically different actions.
  const [waitlistEmail, setWaitlistEmail] = useState("");
  const [waitlistNotes, setWaitlistNotes] = useState("");
  const [waitlistSubmitting, setWaitlistSubmitting] = useState(false);
  const [waitlistDone, setWaitlistDone] = useState(false);
  const [waitlistError, setWaitlistError] = useState<string | null>(null);

  async function joinWaitlist(e: React.FormEvent) {
    e.preventDefault();
    if (!waitlistEmail.trim()) return;
    setWaitlistSubmitting(true);
    setWaitlistError(null);
    const { error } = await supabase.from("waitlist").insert({
      email: waitlistEmail.trim().toLowerCase(),
      notes: waitlistNotes.trim() || null,
      source: "landing",
    });
    setWaitlistSubmitting(false);
    if (error) {
      // Friendlier copy for the unique-violation case (already on list).
      if (error.code === "23505" || /duplicate/i.test(error.message)) {
        setWaitlistDone(true);
        return;
      }
      setWaitlistError(error.message);
      return;
    }
    setWaitlistDone(true);
  }

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
    if (inviteErr) { setError(inviteErr); setLoading(false); return; }
    const { error } = await supabase.auth.signInWithOtp({
      email, options: { emailRedirectTo: window.location.origin },
    });
    setLoading(false);
    if (error) setError(error.message);
    else setSent(true);
  }

  async function passwordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const signIn = await supabase.auth.signInWithPassword({ email, password });
    if (!signIn.error) { setLoading(false); return; }
    const inviteErr = await redeemInvite(email, code);
    if (inviteErr) { setError(inviteErr); setLoading(false); return; }
    const signUp = await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (signUp.error) setError(signUp.error.message);
  }

  function signInWithOrcid() {
    const ORCID_BASE = "https://orcid.org";
    const clientId = (import.meta as any).env?.VITE_ORCID_CLIENT_ID;
    if (!clientId) {
      setError("ORCID sign-in not configured (set VITE_ORCID_CLIENT_ID in Vercel env).");
      return;
    }
    const url = new URL(`${ORCID_BASE}/oauth/authorize`);
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "/authenticate /read-limited");
    url.searchParams.set("redirect_uri", `${SUPABASE_URL}/functions/v1/orcid-callback`);
    window.location.href = url.toString();
  }

  async function signInWithGoogle() {
    setError(null);
    if (!email || !code) {
      setError("Enter email + invite code first — Google sign-in still needs them.");
      return;
    }
    const inviteErr = await redeemInvite(email, code);
    if (inviteErr) { setError(inviteErr); return; }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google", options: { redirectTo: window.location.origin },
    });
    if (error) setError(error.message);
  }

  function scrollToAuth() {
    document.getElementById("auth-card")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <div className="bg-bg-primary text-text-primary">
      {/* ──────────────── HERO ──────────────── */}
      <header className="relative overflow-hidden">
        {/* warm cream + emerald + topaz gradient backdrop */}
        <div
          aria-hidden
          className="absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(ellipse at 20% 0%, rgba(63, 110, 85, 0.18) 0%, transparent 55%), " +
              "radial-gradient(ellipse at 100% 30%, rgba(168, 133, 58, 0.20) 0%, transparent 50%), " +
              "linear-gradient(180deg, #FDFAF1 0%, #F4EDDD 100%)",
          }}
        />
        <div className="max-w-5xl mx-auto px-6 pt-12 pb-16 sm:pt-20 sm:pb-24">
          <div className="flex items-center gap-3 mb-10">
            <img src="/logo.svg" alt="" className="w-9 h-9 rounded-lg shadow-sm" />
            <span className="font-serif text-[18px] font-semibold tracking-tight">
              Literature Companion
            </span>
            <span className="ml-2 text-[10px] uppercase tracking-wider font-semibold text-jewel-topaz bg-jewel-topaz/10 px-2 py-0.5 rounded-full">
              Alpha
            </span>
          </div>

          <h1 className="font-serif text-[44px] sm:text-[64px] leading-[1.05] font-semibold tracking-tight max-w-3xl">
            The literature, <span className="text-jewel-emerald">narrated</span> —
            shaped by your interests.
          </h1>
          <p className="mt-6 text-[18px] sm:text-[20px] leading-relaxed font-serif text-text-primary/85 max-w-2xl">
            A research feed that reads PubMed every morning against{" "}
            <em>your</em> interests, ranks the day's papers, and renders a 5–10
            minute audio briefing you can listen to over coffee.
          </p>

          <div className="mt-8 flex flex-wrap gap-3 items-center">
            <button
              onClick={() => document.getElementById("waitlist")?.scrollIntoView({ behavior: "smooth", block: "center" })}
              className="rounded-full bg-jewel-emerald text-white font-semibold px-6 py-3 text-base shadow-sm active:opacity-80 hover:shadow-md transition"
            >
              Request a token →
            </button>
            <button
              onClick={() => { setMode("password"); scrollToAuth(); }}
              className="rounded-full bg-bg-card text-text-primary font-medium px-5 py-3 text-base border border-stroke active:opacity-80"
            >
              Sign in
            </button>
            <span className="text-caption text-text-secondary ml-2">
              Built for clinician-scientists.
            </span>
          </div>

          {/* HERO PREVIEW: stacked feed card + audio player mockup */}
          <div className="mt-14 grid lg:grid-cols-[1.2fr_1fr] gap-6 items-start">
            <FeedPreview />
            <BriefingPreview />
          </div>
        </div>
      </header>

      {/* ──────────────── FEATURE PILLARS ──────────────── */}
      <section className="max-w-5xl mx-auto px-6 py-16 sm:py-20">
        <div className="text-eyebrow font-semibold text-jewel-emerald uppercase tracking-wider mb-3">
          What you get
        </div>
        <h2 className="font-serif text-[34px] sm:text-[42px] font-semibold leading-tight max-w-2xl mb-10">
          Two things a research feed should actually do.
        </h2>

        <div className="grid md:grid-cols-2 gap-4">
          <Pillar
            tone="emerald"
            tag="01 · Ranked"
            title="An interest-shaped feed"
            body="Seed it with papers, an ORCID, or a sentence about your work. Every new paper from PubMed gets ranked against what you actually care about. Top journals first, then thoughtful discovery picks."
          />
          <Pillar
            tone="topaz"
            tag="02 · Spoken"
            title="A morning briefing"
            body="Every weekday at 5:30 your time, a 5–10 min audio digest lands in your feed. Editorial tone, not robotic — written like a friend who read the literature so you didn't have to."
          />
        </div>
      </section>

      {/* ──────────────── HOW IT WORKS ──────────────── */}
      <section className="max-w-5xl mx-auto px-6 py-16 sm:py-20 border-t border-stroke">
        <div className="text-eyebrow font-semibold text-jewel-topaz uppercase tracking-wider mb-3">
          How it works
        </div>
        <h2 className="font-serif text-[34px] sm:text-[42px] font-semibold leading-tight max-w-3xl mb-12">
          Set it up once. Read smarter every morning.
        </h2>

        <div className="grid md:grid-cols-4 gap-6">
          <Step
            num="1"
            title="Tell it your interests"
            body="ORCID import, paper DOIs, or a sentence in your own words. Three options, pick whichever's fastest."
          />
          <Step
            num="2"
            title="Pick your journals"
            body="Curated bundles for heme/onc, GI, immunology, neuro, cardio. Or hand-pick. Or both."
          />
          <Step
            num="3"
            title="We do the reading"
            body="We find the things you don't want to miss — ranked against your interests, surfaced as a feed and a morning audio briefing."
          />
          <Step
            num="4"
            title="Just open the app"
            body="The feed is sorted. The briefing is queued. Saved papers export to BibTeX one tap away."
          />
        </div>
      </section>

      {/* ──────────────── BUILT FOR ──────────────── */}
      <section className="max-w-5xl mx-auto px-6 py-16 sm:py-20 border-t border-stroke">
        <div className="grid md:grid-cols-2 gap-10 items-center">
          <div>
            <div className="text-eyebrow font-semibold text-jewel-amethyst uppercase tracking-wider mb-3">
              Who this is for
            </div>
            <h2 className="font-serif text-[34px] sm:text-[42px] font-semibold leading-tight mb-5">
              Built by a clinician-scientist for clinician-scientists.
            </h2>
            <p className="font-serif text-[17px] leading-relaxed text-text-primary/85">
              When you search, the papers you actually want are buried under
              conference abstracts, predatory-journal noise, and topical
              near-misses. Literature Companion filters by signal — abstracts
              must be real, journals must matter, your interests must point
              somewhere.
            </p>
            <ul className="mt-5 space-y-2 text-[15px] font-serif">
              <li>· Curated tier-1 list across heme/onc, GI, immunology, cardio, neuro, ID, rheum</li>
              <li>· Predatory publishers blocked by default</li>
              <li>· Conference abstracts auto-filtered — no signal in title alone</li>
              <li>· Author-following: every new paper from a PI you care about</li>
            </ul>
          </div>
          <div>
            <SamplePaperCard />
          </div>
        </div>
      </section>

      {/* ──────────────── AUTH CARD ──────────────── */}
      <section
        id="auth-card"
        className="max-w-5xl mx-auto px-6 py-16 sm:py-24 border-t border-stroke"
      >
        <div className="max-w-md mx-auto bg-bg-card rounded-3xl shadow-lg p-7 sm:p-9">
          <div className="text-eyebrow font-semibold text-jewel-emerald uppercase tracking-wider mb-2">
            Get started
          </div>
          <h2 className="font-serif text-[28px] font-semibold leading-tight mb-4">
            {sent ? "Check your inbox." : "Sign in or claim your invite."}
          </h2>

          {sent ? (
            <>
              <p className="text-base text-text-secondary leading-relaxed">
                We sent a one-time link to <strong>{email}</strong>. Open
                it on this device — it'll bring you right back here, signed in.
              </p>
              <button
                className="mt-6 text-jewel-emerald font-medium text-sm"
                onClick={() => { setSent(false); setEmail(""); setCode(""); }}
              >
                Send another link
              </button>
            </>
          ) : (
            <>
              <p className="text-caption text-text-secondary mb-5">
                Alpha access is invite-only. Sign-up needs a code; sign-in
                with an existing account just needs your password.
              </p>

              <div className="inline-flex bg-bg-primary rounded-full p-0.5 text-[12px] font-semibold mb-3">
                <button
                  type="button"
                  onClick={() => setMode("magic")}
                  className={`px-3 py-1.5 rounded-full transition ${mode === "magic" ? "bg-jewel-emerald text-white" : "text-text-secondary"}`}
                >
                  Magic link
                </button>
                <button
                  type="button"
                  onClick={() => setMode("password")}
                  className={`px-3 py-1.5 rounded-full transition ${mode === "password" ? "bg-jewel-emerald text-white" : "text-text-secondary"}`}
                >
                  Password
                </button>
              </div>

              <form onSubmit={mode === "magic" ? sendLink : passwordSubmit} className="space-y-3">
                <input
                  type="text" autoCapitalize="characters"
                  placeholder="Invite code (sign-up only)"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  className="w-full rounded-xl bg-bg-primary px-4 py-3 text-base text-text-primary placeholder:text-text-secondary/60 border border-transparent focus:border-jewel-emerald focus:outline-none tracking-wider font-mono"
                />
                <input
                  type="email" autoComplete="email" inputMode="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full rounded-xl bg-bg-primary px-4 py-3 text-base text-text-primary placeholder:text-text-secondary/60 border border-transparent focus:border-jewel-emerald focus:outline-none"
                />
                {mode === "password" && (
                  <input
                    type="password" autoComplete="current-password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required minLength={6}
                    className="w-full rounded-xl bg-bg-primary px-4 py-3 text-base text-text-primary placeholder:text-text-secondary/60 border border-transparent focus:border-jewel-emerald focus:outline-none"
                  />
                )}
                <button
                  type="submit"
                  disabled={loading || !email ||
                    (mode === "password" && password.length < 6) ||
                    (mode === "magic" && !code)}
                  className="w-full rounded-xl bg-jewel-emerald text-white font-semibold py-3 disabled:opacity-50 active:opacity-80"
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
                onClick={signInWithOrcid}
                className="mt-4 w-full rounded-xl bg-jewel-emerald text-white font-semibold py-3 active:opacity-80 flex items-center justify-center gap-3 shadow-sm"
              >
                <svg width="18" height="18" viewBox="0 0 256 256" aria-hidden="true">
                  <path fill="#FFFFFF" d="M128 0C57.3 0 0 57.3 0 128s57.3 128 128 128 128-57.3 128-128S198.7 0 128 0zM86.3 186.2H70.9V79.1h15.4v107.1zm-7.7-118c-5.4 0-9.7-4.4-9.7-9.7s4.4-9.7 9.7-9.7 9.7 4.4 9.7 9.7-4.3 9.7-9.7 9.7zm107 78.2c0 22.4-13.4 39.7-37.5 39.7H114.7V79.1h33.4c24.1 0 37.5 16.7 37.5 39.7v28.6zm-15.4-26c0-15.9-9-25.2-23.9-25.2h-15.5v74.7h15.5c14.9 0 23.9-9.3 23.9-25.2v-24.3z"/>
                </svg>
                Continue with ORCID — auto-import your works
              </button>

              <button
                type="button"
                onClick={signInWithGoogle}
                className="mt-2 w-full rounded-xl bg-bg-primary border border-stroke text-text-primary font-medium py-3 active:opacity-80 flex items-center justify-center gap-3"
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

          {error && <div className="mt-4 text-sm text-red-600">{error}</div>}
        </div>
      </section>

      {/* ──────────────── WAITLIST ──────────────── */}
      <section
        id="waitlist"
        className="max-w-5xl mx-auto px-6 py-16 sm:py-20 border-t border-stroke"
      >
        <div className="max-w-md mx-auto text-center">
          <div className="text-eyebrow font-semibold text-jewel-topaz uppercase tracking-wider mb-2">
            Alpha — invite only
          </div>
          <h2 className="font-serif text-[28px] font-semibold leading-tight mb-3">
            Request a token
          </h2>
          <p className="font-serif text-[15px] text-text-secondary mb-6 leading-relaxed">
            Drop your email and we'll send a code as we onboard the next
            cohort. Tell us what you research — it helps us prioritize.
          </p>
          {waitlistDone ? (
            <div className="bg-jewel-emerald/10 border border-jewel-emerald/30 rounded-2xl p-5 text-left">
              <div className="text-jewel-emerald font-semibold mb-1">✓ You're on the list.</div>
              <p className="text-caption text-text-secondary">
                We'll email <strong>{waitlistEmail || "you"}</strong> when
                we have a slot. Usually a few days.
              </p>
            </div>
          ) : (
            <form onSubmit={joinWaitlist} className="bg-bg-card rounded-2xl p-5 text-left space-y-3 shadow-sm">
              <input
                type="email"
                required
                inputMode="email"
                autoComplete="email"
                placeholder="you@university.edu"
                value={waitlistEmail}
                onChange={(e) => setWaitlistEmail(e.target.value)}
                className="w-full rounded-xl bg-bg-primary px-4 py-3 text-base text-text-primary placeholder:text-text-secondary/60 border border-transparent focus:border-jewel-emerald focus:outline-none"
              />
              <textarea
                placeholder="What do you work on? (optional, helps us prioritize)"
                value={waitlistNotes}
                onChange={(e) => setWaitlistNotes(e.target.value)}
                rows={3}
                className="w-full rounded-xl bg-bg-primary px-4 py-3 text-base text-text-primary placeholder:text-text-secondary/60 border border-transparent focus:border-jewel-emerald focus:outline-none resize-none font-serif"
              />
              <button
                type="submit"
                disabled={waitlistSubmitting || !waitlistEmail.trim()}
                className="w-full rounded-xl bg-jewel-emerald text-white font-semibold py-3 disabled:opacity-50 active:opacity-80"
              >
                {waitlistSubmitting ? "Adding…" : "Add me to the waitlist"}
              </button>
              {waitlistError && (
                <div className="text-sm text-red-600">{waitlistError}</div>
              )}
            </form>
          )}
        </div>
      </section>

      <footer className="max-w-5xl mx-auto px-6 py-10 border-t border-stroke text-caption text-text-secondary text-center">
        © Joshua A. Fein 2026
      </footer>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Visual subcomponents
// ─────────────────────────────────────────────────────────────────

function FeedPreview() {
  return (
    <div className="relative">
      <div className="absolute -inset-4 bg-gradient-to-br from-jewel-emerald/15 to-jewel-topaz/10 blur-2xl -z-10 rounded-3xl" />
      <div className="bg-bg-card rounded-2xl shadow-xl overflow-hidden border border-stroke">
        <div className="px-5 pt-5 pb-3 bg-bg-primary/60">
          <div className="text-eyebrow font-semibold text-jewel-emerald uppercase tracking-wider">
            Today's Briefing — ready
          </div>
          <div className="font-serif text-[18px] mt-1 font-semibold leading-snug">
            6 papers · 8 min listen
          </div>
        </div>
        <div className="px-5 py-4 space-y-3">
          {[
            { tag: "Immunity", title: "Spatial profiling reveals tissue-resident memory T-cell micro-niches", chip: "review" },
            { tag: "★ Blood", title: "Single-cell maps reveal a regulatory T-cell axis sustaining HSCT chimerism", chip: "research" },
            { tag: "Cell", title: "FMT plus first-line checkpoint blockade boosts CD8⁺-driven tumor clearance", chip: "trial" },
          ].map((p, i) => (
            <div key={i} className="border-b border-stroke/60 last:border-0 pb-3 last:pb-0">
              <div className="text-eyebrow font-semibold text-text-secondary uppercase tracking-wider line-clamp-1">
                <span className="text-jewel-topaz">★</span> {p.tag}
              </div>
              <div className="font-serif text-[15px] mt-1 leading-snug text-text-primary line-clamp-2">
                {p.title}
              </div>
              <div className="mt-1.5 flex gap-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-jewel-emerald/15 text-jewel-emerald">
                  {p.chip}
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-bg-primary text-text-secondary">
                  Strong match
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function BriefingPreview() {
  return (
    <div className="relative">
      <div className="absolute -inset-4 bg-gradient-to-br from-jewel-topaz/15 to-jewel-emerald/10 blur-2xl -z-10 rounded-3xl" />
      <div className="bg-bg-card rounded-2xl shadow-xl overflow-hidden border border-stroke p-5">
        <div className="text-eyebrow font-semibold text-jewel-emerald uppercase tracking-wider mb-2">
          Now playing
        </div>
        <div className="font-serif text-[15px] leading-snug font-semibold mb-4 line-clamp-2">
          Single-cell maps reveal a regulatory T-cell axis sustaining HSCT chimerism
        </div>
        {/* scrubber with chapter ticks */}
        <div className="relative h-2 bg-bg-primary rounded-full mb-1">
          <div className="absolute inset-y-0 left-0 bg-jewel-emerald rounded-full" style={{ width: "37%" }} />
          {[10, 28, 37, 55, 72, 88].map((p, i) => (
            <div
              key={i}
              className={`absolute top-1/2 -translate-y-1/2 w-1 h-3 rounded-sm ${i === 2 ? "bg-jewel-topaz" : "bg-text-primary/40"}`}
              style={{ left: `calc(${p}% - 2px)` }}
            />
          ))}
        </div>
        <div className="flex justify-between text-[11px] text-text-secondary font-mono mb-4">
          <span>2:58</span><span>8:01</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-text-primary text-sm font-mono w-12 text-center">−15</span>
          <span className="text-text-primary text-xl">⏮</span>
          <span className="w-14 h-14 rounded-full bg-jewel-emerald text-white text-xl flex items-center justify-center shadow-md">▶</span>
          <span className="text-text-primary text-xl">⏭</span>
          <span className="text-text-primary text-sm font-mono w-12 text-center">+15</span>
          <span className="text-jewel-topaz text-sm font-semibold w-10 text-center">1.5×</span>
        </div>
        <div className="mt-4 pt-4 border-t border-stroke flex items-center gap-2">
          <span className="rounded-full bg-jewel-topaz text-white px-3 py-1 text-xs font-semibold">★ Pin</span>
          <span className="rounded-full bg-bg-primary text-text-secondary px-3 py-1 text-xs">Skip ↷</span>
          <span className="text-caption text-text-secondary ml-auto">Chapter 3 · 6</span>
        </div>
      </div>
    </div>
  );
}

function Pillar({
  tone, tag, title, body,
}: { tone: "emerald" | "topaz" | "amethyst"; tag: string; title: string; body: string }) {
  const toneClasses = {
    emerald: { tag: "text-jewel-emerald", bg: "from-jewel-emerald/12 to-transparent", ring: "border-jewel-emerald/20" },
    topaz: { tag: "text-jewel-topaz", bg: "from-jewel-topaz/15 to-transparent", ring: "border-jewel-topaz/25" },
    amethyst: { tag: "text-jewel-amethyst", bg: "from-jewel-amethyst/15 to-transparent", ring: "border-jewel-amethyst/25" },
  }[tone];
  return (
    <div className={`rounded-2xl bg-gradient-to-br ${toneClasses.bg} border ${toneClasses.ring} p-5`}>
      <div className={`text-eyebrow font-semibold ${toneClasses.tag} uppercase tracking-wider`}>
        {tag}
      </div>
      <h3 className="font-serif text-[22px] font-semibold leading-tight mt-2">{title}</h3>
      <p className="font-serif text-[15px] leading-relaxed mt-2 text-text-primary/85">
        {body}
      </p>
    </div>
  );
}

function Step({ num, title, body }: { num: string; title: string; body: string }) {
  return (
    <div>
      <div className="font-serif text-[42px] leading-none font-semibold text-jewel-emerald/40">
        {num}
      </div>
      <div className="font-semibold text-[15px] mt-2">{title}</div>
      <p className="font-serif text-[14px] leading-relaxed text-text-primary/80 mt-1">
        {body}
      </p>
    </div>
  );
}

function SamplePaperCard() {
  return (
    <div className="bg-bg-card rounded-2xl shadow-xl border border-stroke overflow-hidden">
      <div className="aspect-[16/9] bg-gradient-to-br from-jewel-emerald/30 to-jewel-topaz/20 relative">
        <svg viewBox="0 0 320 180" className="w-full h-full" preserveAspectRatio="xMidYMid slice">
          <defs>
            <pattern id="lp-grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#2E2A24" strokeWidth="0.4" opacity="0.06" />
            </pattern>
          </defs>
          <rect width="320" height="180" fill="url(#lp-grid)" />
          <g transform="translate(60 25) rotate(-5)">
            <rect width="140" height="120" rx="6" fill="#FDFAF1" stroke="#2E2A24" strokeWidth="1.4" opacity="0.95" />
            <rect x="14" y="14" width="80" height="6" rx="1.5" fill="#3F6E55" opacity="0.75" />
            <path d="M 14 60 Q 30 50 50 40 T 90 28 L 110 22" fill="none" stroke="#A8853A" strokeWidth="2" />
            <circle cx="50" cy="40" r="2.5" fill="#A8853A" />
            <circle cx="70" cy="34" r="2.5" fill="#A8853A" />
            <circle cx="90" cy="28" r="2.5" fill="#A8853A" />
          </g>
          <g transform="translate(160 50) rotate(4)">
            <rect width="130" height="110" rx="6" fill="#FDFAF1" stroke="#2E2A24" strokeWidth="1.4" />
            <rect x="14" y="22" width="92" height="9" rx="2" fill="#B86E4C" opacity="0.32" />
            <rect x="14" y="14" width="92" height="6" rx="1.5" fill="#2E2A24" />
          </g>
        </svg>
      </div>
      <div className="p-5">
        <div className="text-eyebrow font-semibold text-text-secondary uppercase tracking-wider line-clamp-1">
          <span className="text-jewel-topaz">★</span> Cell · Strong match
        </div>
        <div className="font-serif text-[18px] mt-1 font-semibold leading-snug">
          IFNγ-induced memory in human macrophages is sustained by the durability of cytokine signaling itself
        </div>
        <p className="font-serif text-[14px] leading-relaxed mt-2 text-text-primary/80 line-clamp-3">
          A two-state model where macrophage memory is encoded not by chromatin
          marks alone but by the kinetics of receptor turnover, suggesting
          interventions in chronic inflammatory states.
        </p>
      </div>
    </div>
  );
}
