import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

export default function TourPage() {
  return (
    <div className="bg-bg-primary text-text-primary">
      <TourNav />
      <Hero />
      <ListenSection />
      <MorningRitual />
      <FeatureGallery />
      <PipelineSection />
      <BuiltForSection />
      <FinalCTA />
      <Footer />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Top nav — public, links back to /
// ─────────────────────────────────────────────────────────────────
function TourNav() {
  return (
    <nav className="sticky top-0 z-20 backdrop-blur bg-bg-primary/80 border-b border-stroke">
      <div className="max-w-6xl mx-auto px-6 py-3 flex items-center gap-3">
        <Link to="/" className="flex items-center gap-2">
          <img src="/logo.svg" alt="" className="w-7 h-7 rounded-md" />
          <span className="font-serif font-semibold text-[15px] tracking-tight">
            Literature Companion
          </span>
        </Link>
        <span className="text-[10px] uppercase tracking-wider font-semibold text-jewel-topaz bg-jewel-topaz/10 px-2 py-0.5 rounded-full">
          Alpha
        </span>
        <div className="ml-auto flex items-center gap-1 text-[13px] font-medium whitespace-nowrap">
          <a href="#listen" className="hidden sm:block px-3 py-1.5 rounded-full text-text-secondary hover:text-text-primary">Listen</a>
          <a href="#tour" className="hidden sm:block px-3 py-1.5 rounded-full text-text-secondary hover:text-text-primary">Tour</a>
          <a href="#pipeline" className="hidden md:block px-3 py-1.5 rounded-full text-text-secondary hover:text-text-primary">How it works</a>
          <Link to="/" className="ml-2 px-4 py-1.5 rounded-full bg-jewel-emerald text-white">Sign in</Link>
        </div>
      </div>
    </nav>
  );
}

// ─────────────────────────────────────────────────────────────────
// Hero
// ─────────────────────────────────────────────────────────────────
function Hero() {
  return (
    <header className="relative overflow-hidden">
      <div
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse at 15% 0%, rgba(63, 122, 92, 0.18) 0%, transparent 55%), " +
            "radial-gradient(ellipse at 100% 30%, rgba(184, 144, 57, 0.20) 0%, transparent 50%), " +
            "linear-gradient(180deg, #FDFAF1 0%, #F4EDDD 100%)",
        }}
      />
      <div className="max-w-6xl mx-auto px-6 pt-16 pb-20 sm:pt-24">
        <div className="text-eyebrow font-semibold text-jewel-emerald uppercase tracking-wider mb-4">
          A guided tour
        </div>
        <h1 className="font-serif text-[44px] sm:text-[60px] leading-[1.05] font-semibold tracking-tight max-w-3xl">
          See what a research feed{" "}
          <span className="text-jewel-emerald">shaped by your interests</span>{" "}
          actually looks like.
        </h1>
        <p className="mt-6 text-[18px] leading-relaxed font-serif text-text-primary/85 max-w-2xl">
          Literature Companion reads PubMed every morning, ranks the day's
          papers against your interests, and renders an audio briefing in the
          voice of an editorial friend who already read everything for you.
        </p>
        <div className="mt-8 flex flex-wrap gap-3 items-center">
          <a href="#listen" className="rounded-full bg-jewel-emerald text-white font-semibold px-6 py-3 text-base shadow-sm hover:shadow-md transition">
            ▶ Hear a sample
          </a>
          <a href="#tour" className="rounded-full bg-bg-card text-text-primary font-medium px-5 py-3 text-base border border-stroke">
            Take the visual tour →
          </a>
        </div>
      </div>
    </header>
  );
}

// ─────────────────────────────────────────────────────────────────
// Audio sample with synthetic transcript scroll
// ─────────────────────────────────────────────────────────────────
function ListenSection() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [t, setT] = useState(0);
  const [duration, setDuration] = useState(130);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime = () => setT(a.currentTime);
    const onMeta = () => setDuration(a.duration || 130);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("loadedmetadata", onMeta);
    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onPause);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("loadedmetadata", onMeta);
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onPause);
    };
  }, []);

  function toggle() {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) a.play(); else a.pause();
  }

  function fmt(s: number) {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60).toString().padStart(2, "0");
    return `${m}:${sec}`;
  }

  return (
    <section id="listen" className="border-t border-stroke">
      <div className="max-w-6xl mx-auto px-6 py-20">
        <div className="grid lg:grid-cols-[1fr_1.1fr] gap-10 items-start">
          <div>
            <div className="text-eyebrow font-semibold text-jewel-topaz uppercase tracking-wider mb-3">
              The 90-second sample
            </div>
            <h2 className="font-serif text-[34px] sm:text-[42px] font-semibold leading-tight mb-5">
              This is what your morning briefing sounds like.
            </h2>
            <p className="font-serif text-[17px] leading-relaxed text-text-primary/85 mb-4">
              An excerpt from a real briefing — generated by gpt-oss-120b,
              polished by mistral-small3.1, and narrated by a Kokoro TTS voice
              tuned for biomedical vocabulary (no more "FOXP-three" or
              "C-D-four-plus" stumbles).
            </p>
            <p className="font-serif text-[14px] text-text-secondary leading-relaxed">
              The clip below is one paper-block from this morning's digest — a
              synthesis from <em>Immunity</em> arguing that vaccine design has
              to optimize T-cell, B-cell, and antibody memory in concert,
              not one at a time. ~90 seconds; turn the volume up.
            </p>
          </div>

          <div className="relative">
            <div className="absolute -inset-4 bg-gradient-to-br from-jewel-topaz/15 to-jewel-emerald/12 blur-2xl -z-10 rounded-3xl" />
            <div className="bg-bg-card rounded-2xl shadow-xl border border-stroke overflow-hidden">
              <div className="px-6 pt-6 pb-2">
                <div className="text-eyebrow font-semibold text-jewel-emerald uppercase tracking-wider">
                  Now playing — sample
                </div>
                <div className="font-serif text-[17px] mt-1 font-semibold leading-snug">
                  Coordinated T-, B-, and antibody memory: a unified blueprint
                  for vaccines
                </div>
                <div className="text-caption text-text-secondary mt-1">
                  Immunity · synthesis · CD8⁺ T-cell biology
                </div>
              </div>

              <div className="px-6 pt-3 pb-5">
                <audio ref={audioRef} src="/tour-sample.m4a" preload="none" />
                <div className="relative h-2 bg-bg-primary rounded-full mb-2 overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 bg-jewel-emerald rounded-full transition-[width] duration-200"
                    style={{ width: `${duration ? (t / duration) * 100 : 0}%` }}
                  />
                </div>
                <div className="flex justify-between text-[11px] text-text-secondary font-mono mb-4">
                  <span>{fmt(t)}</span>
                  <span>{fmt(duration)}</span>
                </div>

                <div className="flex items-center justify-center gap-5">
                  <button
                    onClick={() => audioRef.current && (audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 15))}
                    className="text-text-primary text-sm font-mono"
                    aria-label="Back 15 seconds"
                  >
                    −15
                  </button>
                  <button
                    onClick={toggle}
                    className="w-16 h-16 rounded-full bg-jewel-emerald text-white text-2xl flex items-center justify-center shadow-md active:opacity-80"
                    aria-label={playing ? "Pause" : "Play"}
                  >
                    {playing ? "❚❚" : "▶"}
                  </button>
                  <button
                    onClick={() => audioRef.current && (audioRef.current.currentTime = Math.min(duration, audioRef.current.currentTime + 15))}
                    className="text-text-primary text-sm font-mono"
                    aria-label="Forward 15 seconds"
                  >
                    +15
                  </button>
                </div>
              </div>

              <div className="bg-bg-primary/60 px-6 py-5 border-t border-stroke">
                <div className="text-eyebrow font-semibold text-text-secondary uppercase tracking-wider mb-2">
                  Transcript snippet
                </div>
                <p className="font-serif text-[14px] leading-relaxed text-text-primary/85">
                  "Crotty's Immunity piece stitches together the three arms of
                  adaptive immunity — T cells, B cells, antibodies — into a
                  single blueprint for vaccines. The central claim is that
                  focusing on any single component, say neutralizing
                  antibodies, is like trying to win a chess match by moving
                  only the queen…"
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────
// Morning ritual — 3-step illustrated
// ─────────────────────────────────────────────────────────────────
function MorningRitual() {
  return (
    <section className="border-t border-stroke bg-bg-card/40">
      <div className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-eyebrow font-semibold text-jewel-emerald uppercase tracking-wider mb-3">
          The morning ritual
        </div>
        <h2 className="font-serif text-[34px] sm:text-[42px] font-semibold leading-tight max-w-3xl mb-12">
          Coffee in one hand, papers in the other ear.
        </h2>
        <div className="grid md:grid-cols-3 gap-6">
          <RitualStep
            icon={<CoffeeIcon />}
            num="5:30 am"
            title="The pipeline runs"
            body="Behind the scenes, every new paper from PubMed gets scored against your interests. The top six get a draft digest and a fresh audio render."
          />
          <RitualStep
            icon={<PhoneIcon />}
            num="7:15 am"
            title="You open the app"
            body="The briefing is queued at the top of your feed. Tap once. Walk to the train. The chapter ticks on the scrubber tell you which paper is up."
          />
          <RitualStep
            icon={<StarIcon />}
            num="During play"
            title="Pin what catches you"
            body="A single tap from the player saves the paper into your library. Open it later, full-text linked, ready to read."
          />
        </div>
      </div>
    </section>
  );
}

function RitualStep({ icon, num, title, body }: { icon: React.ReactNode; num: string; title: string; body: string }) {
  return (
    <div className="bg-bg-primary rounded-2xl border border-stroke p-6 shadow-sm">
      <div className="w-12 h-12 rounded-xl bg-jewel-emerald/10 flex items-center justify-center mb-4">
        {icon}
      </div>
      <div className="text-caption font-semibold text-jewel-topaz uppercase tracking-wider">
        {num}
      </div>
      <h3 className="font-serif text-[20px] font-semibold leading-tight mt-1 mb-2">
        {title}
      </h3>
      <p className="font-serif text-[14px] leading-relaxed text-text-primary/80">
        {body}
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Feature gallery — 6 illustrated mock screens
// ─────────────────────────────────────────────────────────────────
function FeatureGallery() {
  return (
    <section id="tour" className="border-t border-stroke">
      <div className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-eyebrow font-semibold text-jewel-amethyst uppercase tracking-wider mb-3">
          The visual tour
        </div>
        <h2 className="font-serif text-[34px] sm:text-[42px] font-semibold leading-tight max-w-3xl mb-12">
          Six screens, one workflow.
        </h2>

        <div className="space-y-20">
          <FeatureRow
            tone="emerald"
            tag="Feed"
            title="A ranked stack of today's papers."
            body="Each card carries journal, tier, type-chip, and a one-line stake. Swipe left to dismiss, right to save. Long-press the corner to dog-ear for later. The ordering re-cooks every morning but freezes the moment you open it, so you don't lose your place."
            screen={<FeedScreen />}
            reverse={false}
          />
          <FeatureRow
            tone="topaz"
            tag="Briefing"
            title="Listen first. Pin what matters."
            body="Chapter scrubber shows you which paper you're on, jewel-toned ticks mark the boundaries, and the Pin button promotes the active paper into your library. The full transcript scrolls below, time-synced — handy for quoting later."
            screen={<BriefingScreen />}
            reverse
          />
          <FeatureRow
            tone="sapphire"
            tag="Paper detail"
            title="Everything in one tap, nothing in two."
            body="The TLDR (≈90 words, generated by a per-paper summary model), the abstract, the figures lifted from the publisher landing page, and twin buttons to open the article at the publisher or PubMed. A quiet 'why this paper?' panel at the bottom explains the rank."
            screen={<PaperDetailScreen />}
            reverse={false}
          />
          <FeatureRow
            tone="emerald"
            tag="Journals"
            title="Every TOC, in one room."
            body="Latest issues from your favorite journals, side-by-side. New since your last visit are flagged sapphire. A click opens the article in-app first — falls through to the publisher if we don't have the metadata yet."
            screen={<JournalsScreen />}
            reverse
          />
          <FeatureRow
            tone="topaz"
            tag="Library"
            title="Pinned, dismissed, exported."
            body="Three tabs. Saved is your reading list. Dismissed is the receipt of what you said no to (so the model can learn). One-tap BibTeX export for the whole library — or any subset."
            screen={<LibraryScreen />}
            reverse={false}
          />
        </div>
      </div>
    </section>
  );
}

function FeatureRow({
  tone, tag, title, body, screen, reverse,
}: {
  tone: "emerald" | "topaz" | "amethyst" | "sapphire";
  tag: string;
  title: string;
  body: string;
  screen: React.ReactNode;
  reverse: boolean;
}) {
  const toneClass = {
    emerald: "text-jewel-emerald",
    topaz: "text-jewel-topaz",
    amethyst: "text-jewel-amethyst",
    sapphire: "text-jewel-sapphire",
  }[tone];
  return (
    <div className={`grid lg:grid-cols-2 gap-10 items-center ${reverse ? "lg:[&>*:first-child]:order-2" : ""}`}>
      <div>
        <div className={`text-eyebrow font-semibold ${toneClass} uppercase tracking-wider mb-2`}>
          {tag}
        </div>
        <h3 className="font-serif text-[26px] sm:text-[32px] font-semibold leading-tight mb-3">
          {title}
        </h3>
        <p className="font-serif text-[16px] leading-relaxed text-text-primary/85">
          {body}
        </p>
      </div>
      <div className="relative">
        <div className="absolute -inset-3 bg-gradient-to-br from-jewel-emerald/12 via-jewel-topaz/8 to-jewel-amethyst/10 blur-2xl -z-10 rounded-3xl" />
        {screen}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Mock screens (stylized phone frames)
// ─────────────────────────────────────────────────────────────────
function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[340px] rounded-[34px] bg-text-primary p-2 shadow-2xl">
      <div className="rounded-[28px] bg-bg-primary overflow-hidden border border-stroke">
        <div className="h-6 flex items-center justify-center">
          <div className="w-20 h-1 rounded-full bg-text-primary/30" />
        </div>
        <div className="px-3 pb-3">{children}</div>
      </div>
    </div>
  );
}

// One coherent paper-set anchors every screen — same 6 papers the audio
// sample is narrating. Keeps Feed, Briefing, PaperDetail, Library all
// telling the same morning's story.
const TOUR_PAPERS = [
  { tier: "emerald", journal: "Immunity", tag: "review",      title: "Spatial profiling reveals tissue-resident memory T-cell micro-niches" },
  { tier: "emerald", journal: "Immunity", tag: "synthesis",   title: "Coordinated T-, B-, and antibody memory: a unified blueprint for vaccines" },
  { tier: "topaz",   journal: "★ Blood",  tag: "perspective", title: "CLL after COVID: targeted therapies extend life, but cures stay rare" },
  { tier: "topaz",   journal: "★ Blood",  tag: "research",    title: "rs915654 alone reshapes mortality prediction in haploidentical transplants" },
  { tier: "emerald", journal: "Cell",     tag: "research",    title: "FMT plus first-line checkpoint blockade boosts ICI efficacy across three tumors" },
  { tier: "sapphire", journal: "Blood Adv", tag: "letter",    title: "Plasma cfDNA as a surrogate for marrow disease in AML monitoring" },
];

function FeedScreen() {
  return (
    <PhoneFrame>
      <div className="text-eyebrow font-semibold text-jewel-emerald uppercase tracking-wider mb-2 px-1">
        Today · 6 papers
      </div>
      {TOUR_PAPERS.slice(0, 4).map((p, i) => (
        <FeedCard
          key={i}
          tier={p.tier}
          journal={p.journal}
          tag={p.tag}
          title={p.title}
          chip={i === 0 ? "Strong match" : i === 1 ? "Strong match" : i === 2 ? "Worth a look" : "Discovery"}
          just={i === 1}
        />
      ))}
      <div className="mt-3 mx-auto w-12 h-1 rounded-full bg-text-primary/20" />
    </PhoneFrame>
  );
}

function FeedCard({ tier, journal, tag, title, chip, just }: { tier: string; journal: string; tag: string; title: string; chip: string; just: boolean }) {
  const borderTone = {
    emerald: "border-l-jewel-emerald",
    topaz: "border-l-jewel-topaz",
    sapphire: "border-l-jewel-sapphire",
  }[tier as "emerald" | "topaz" | "sapphire"];
  return (
    <div className={`relative bg-bg-card rounded-xl border border-stroke border-l-4 ${borderTone} p-3 mb-2`}>
      {just && (
        <div className="absolute top-3 right-3 flex items-center gap-1 text-[10px] font-semibold text-jewel-topaz">
          <span className="w-1.5 h-1.5 rounded-full bg-jewel-topaz animate-pulse" />
          Just in
        </div>
      )}
      {/* dog-ear corner */}
      <div className="absolute top-0 right-0 w-0 h-0 border-t-[14px] border-t-jewel-topaz/35 border-l-[14px] border-l-transparent rounded-tr-lg" />
      <div className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">
        <span className="text-jewel-topaz">★</span> {journal}
      </div>
      <div className="font-serif text-[13px] mt-1 leading-snug text-text-primary line-clamp-2">
        {title}
      </div>
      <div className="mt-1.5 flex gap-1">
        <span className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-jewel-emerald/15 text-jewel-emerald">
          {tag}
        </span>
        <span className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-bg-primary text-text-secondary">
          {chip}
        </span>
      </div>
    </div>
  );
}

function BriefingScreen() {
  return (
    <PhoneFrame>
      <div className="text-eyebrow font-semibold text-jewel-emerald uppercase tracking-wider mb-2 px-1">
        Morning briefing
      </div>
      <div className="bg-bg-card rounded-xl border border-stroke p-4">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">
          Now playing · ch 1 of 6
        </div>
        <div className="font-serif text-[13px] mt-1 font-semibold leading-snug">
          {TOUR_PAPERS[0].title}
        </div>
        <div className="relative h-1.5 bg-bg-primary rounded-full mt-3">
          <div className="absolute inset-y-0 left-0 bg-jewel-emerald rounded-full" style={{ width: "8%" }} />
          {[8, 28, 44, 60, 78, 92].map((p, i) => (
            <div key={i}
              className={`absolute top-1/2 -translate-y-1/2 w-0.5 h-2.5 rounded-sm ${i === 0 ? "bg-jewel-topaz" : "bg-text-primary/40"}`}
              style={{ left: `calc(${p}% - 1px)` }}
            />
          ))}
        </div>
        <div className="flex justify-between text-[9px] text-text-secondary font-mono mt-1">
          <span>0:48</span><span>10:24</span>
        </div>
        <div className="flex items-center justify-center gap-3 mt-3">
          <span className="text-text-primary text-base">⏮</span>
          <span className="w-11 h-11 rounded-full bg-jewel-emerald text-white text-base flex items-center justify-center shadow-md">▶</span>
          <span className="text-text-primary text-base">⏭</span>
        </div>
        <div className="mt-3 flex gap-1.5">
          <span className="rounded-full bg-jewel-topaz text-white px-2.5 py-1 text-[10px] font-semibold">★ Pin paper</span>
          <span className="rounded-full bg-bg-primary text-text-secondary px-2.5 py-1 text-[10px]">Skip ↷</span>
        </div>
      </div>
      <div className="mt-3 px-1">
        <div className="text-[9px] font-semibold uppercase tracking-wider text-text-secondary mb-1">
          Transcript
        </div>
        <p className="font-serif text-[11px] leading-relaxed text-text-primary/80 line-clamp-5">
          "…the heat-map in figure three B — clusters of CD69-positive
          CD103-positive cells hugging the basement membrane — makes it feel
          like each niche is a little training ground, a gym where the T cells
          get their specific workout…"
        </p>
      </div>
    </PhoneFrame>
  );
}

function PaperDetailScreen() {
  return (
    <PhoneFrame>
      <div className="text-eyebrow font-semibold text-jewel-sapphire uppercase tracking-wider mb-2 px-1">
        ← back to feed
      </div>
      <div className="bg-bg-card rounded-xl border border-stroke overflow-hidden">
        <div className="aspect-[4/3] bg-gradient-to-br from-jewel-sapphire/25 to-jewel-emerald/15 relative">
          <svg viewBox="0 0 200 150" className="w-full h-full">
            <g transform="translate(20 30)">
              <circle cx="40" cy="40" r="30" fill="#3F7A5C" opacity="0.35" />
              <circle cx="80" cy="60" r="22" fill="#B89039" opacity="0.45" />
              <circle cx="110" cy="35" r="18" fill="#3B557F" opacity="0.4" />
              <line x1="40" y1="40" x2="80" y2="60" stroke="#2E2A24" strokeWidth="0.6" opacity="0.4" />
              <line x1="80" y1="60" x2="110" y2="35" stroke="#2E2A24" strokeWidth="0.6" opacity="0.4" />
            </g>
          </svg>
          <div className="absolute bottom-2 right-2 text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-bg-primary/85 text-text-secondary">
            Fig 1 · publisher
          </div>
        </div>
        <div className="p-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">
            <span className="text-jewel-topaz">★</span> {TOUR_PAPERS[0].journal} · {TOUR_PAPERS[0].tag}
          </div>
          <div className="font-serif text-[14px] mt-1 font-semibold leading-snug">
            {TOUR_PAPERS[0].title}
          </div>
          <p className="font-serif text-[11px] leading-relaxed mt-2 text-text-primary/80 line-clamp-4">
            Synthesizes spatial-omics data showing TRM cells partition into
            functionally distinct micro-niches. Authors argue the niche, not
            cell-intrinsic programming alone, dictates whether a TRM fires…
          </p>
          <div className="grid grid-cols-2 gap-1.5 mt-3">
            <div className="text-center text-[10px] font-semibold py-1.5 rounded-lg bg-jewel-emerald text-white">
              Open at publisher
            </div>
            <div className="text-center text-[10px] font-semibold py-1.5 rounded-lg bg-bg-primary border border-stroke text-text-primary">
              PubMed
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-stroke flex items-center gap-1.5">
            <span className="rounded-full bg-jewel-topaz/15 text-jewel-topaz px-2 py-0.5 text-[10px] font-semibold">★ Save</span>
            <span className="rounded-full bg-bg-primary border border-stroke px-2 py-0.5 text-[10px]">📖 Read</span>
            <span className="ml-auto text-[10px] text-text-secondary">why this? ▾</span>
          </div>
        </div>
      </div>
    </PhoneFrame>
  );
}

function JournalsScreen() {
  const journals = [
    { name: "Immunity",  count: 6, fresh: 2 },
    { name: "Blood",     count: 5, fresh: 2 },
    { name: "Cell",      count: 9, fresh: 1 },
    { name: "NEJM",      count: 7, fresh: 0 },
    { name: "Blood Adv", count: 4, fresh: 1 },
    { name: "Lancet",    count: 5, fresh: 0 },
  ];
  return (
    <PhoneFrame>
      <div className="text-eyebrow font-semibold text-jewel-emerald uppercase tracking-wider mb-2 px-1">
        Journals · this week
      </div>
      <div className="grid grid-cols-2 gap-2">
        {journals.map((j, i) => (
          <div key={i} className="bg-bg-card rounded-xl border border-stroke p-3 relative">
            {j.fresh > 0 && (
              <div className="absolute top-2 right-2 text-[9px] font-semibold text-jewel-sapphire bg-jewel-sapphire/15 px-1.5 py-0.5 rounded-full">
                +{j.fresh} new
              </div>
            )}
            <div className="font-serif text-[15px] font-semibold leading-tight">
              {j.name}
            </div>
            <div className="text-[10px] text-text-secondary mt-1">
              {j.count} articles
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 bg-bg-card rounded-xl border border-stroke p-3">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-jewel-sapphire mb-1">
          {TOUR_PAPERS[4].journal} · just dropped
        </div>
        <div className="font-serif text-[12px] leading-snug font-semibold">
          {TOUR_PAPERS[4].title}
        </div>
        <div className="text-[10px] text-text-secondary mt-1">
          Open in app →
        </div>
      </div>
    </PhoneFrame>
  );
}

function LibraryScreen() {
  return (
    <PhoneFrame>
      <div className="flex gap-1 mb-3 bg-bg-card rounded-full p-0.5 text-[11px] font-semibold">
        <span className="px-3 py-1 rounded-full bg-jewel-topaz text-white">★ Saved · 24</span>
        <span className="px-3 py-1 rounded-full text-text-secondary">🗂 Dog-eared</span>
        <span className="px-3 py-1 rounded-full text-jewel-ruby/80">Dismissed</span>
      </div>
      {[TOUR_PAPERS[0], TOUR_PAPERS[3], TOUR_PAPERS[4], TOUR_PAPERS[1]].map((p, i) => (
        <div key={i} className="bg-bg-card rounded-xl border border-stroke p-3 mb-2">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">
            <span className="text-jewel-topaz">★</span> {p.journal}
          </div>
          <div className="font-serif text-[12px] mt-1 leading-snug line-clamp-2">
            {p.title}
          </div>
        </div>
      ))}
      <div className="mt-3 bg-jewel-emerald/10 border border-jewel-emerald/25 rounded-xl p-3 text-center">
        <div className="text-[11px] font-semibold text-jewel-emerald">
          Export 24 papers as BibTeX →
        </div>
      </div>
    </PhoneFrame>
  );
}

// ─────────────────────────────────────────────────────────────────
// Pipeline diagram
// ─────────────────────────────────────────────────────────────────
function PipelineSection() {
  const steps = [
    { tone: "emerald", title: "PubMed harvest", body: "RSS + E-utilities every 90 min, deduped by DOI + title hash." },
    { tone: "sapphire", title: "Score against your interests", body: "Every paper gets ranked against the interest signal you've taught the model — papers, ORCID, or your own words." },
    { tone: "topaz", title: "Per-paper summary", body: "gemma3:12b drafts a TLDR for every keeper." },
    { tone: "amethyst", title: "Daily digest", body: "gpt-oss:120b writes; mistral-small3.1 polishes the prose." },
    { tone: "emerald", title: "Audio render", body: "Kokoro TTS with biomedical pronunciation preprocessor." },
    { tone: "topaz", title: "Push to app", body: "Supabase row + audio file lands before 7am your time." },
  ];
  return (
    <section id="pipeline" className="border-t border-stroke bg-bg-card/40">
      <div className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-eyebrow font-semibold text-jewel-sapphire uppercase tracking-wider mb-3">
          Under the hood
        </div>
        <h2 className="font-serif text-[34px] sm:text-[42px] font-semibold leading-tight max-w-3xl mb-12">
          A six-stage pipeline. Runs while you sleep.
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {steps.map((s, i) => {
            const tone = {
              emerald: { bg: "from-jewel-emerald/12", ring: "border-jewel-emerald/25", text: "text-jewel-emerald" },
              sapphire: { bg: "from-jewel-sapphire/12", ring: "border-jewel-sapphire/25", text: "text-jewel-sapphire" },
              topaz: { bg: "from-jewel-topaz/15", ring: "border-jewel-topaz/30", text: "text-jewel-topaz" },
              amethyst: { bg: "from-jewel-amethyst/15", ring: "border-jewel-amethyst/30", text: "text-jewel-amethyst" },
            }[s.tone as "emerald" | "sapphire" | "topaz" | "amethyst"];
            return (
              <div key={i} className={`relative rounded-2xl bg-gradient-to-br ${tone.bg} to-transparent border ${tone.ring} p-5`}>
                <div className={`text-eyebrow font-semibold ${tone.text} uppercase tracking-wider mb-1`}>
                  Step {i + 1}
                </div>
                <h3 className="font-serif text-[18px] font-semibold leading-tight mb-2">
                  {s.title}
                </h3>
                <p className="font-serif text-[13px] leading-relaxed text-text-primary/80">
                  {s.body}
                </p>
              </div>
            );
          })}
        </div>
        <div className="mt-10 text-caption text-text-secondary max-w-2xl">
          Inference runs locally — paper text never leaves the building.
          Only metadata is stored in the cloud; full-text fetches go straight
          from your device to the publisher.
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────
// Built for whom
// ─────────────────────────────────────────────────────────────────
function BuiltForSection() {
  return (
    <section className="border-t border-stroke">
      <div className="max-w-6xl mx-auto px-6 py-20">
        <div className="grid md:grid-cols-2 gap-10">
          <div>
            <div className="text-eyebrow font-semibold text-jewel-amethyst uppercase tracking-wider mb-3">
              Built for
            </div>
            <h2 className="font-serif text-[34px] sm:text-[42px] font-semibold leading-tight mb-5">
              Clinician-scientists who can't read 200 abstracts a week.
            </h2>
            <p className="font-serif text-[16px] leading-relaxed text-text-primary/85 mb-5">
              The papers you actually want are buried under conference
              abstracts, predatory-journal noise, and topical near-misses.
              Literature Companion filters by signal first, presentation second.
            </p>
            <ul className="space-y-2 text-[15px] font-serif">
              <li>· Curated tier-1 list across heme/onc, immunology, cardio, neuro, ID, GI, rheum</li>
              <li>· Frontiers / MDPI / OMICS predatory venues blocked by default</li>
              <li>· Conference abstracts auto-filtered — title alone is no signal</li>
              <li>· Author-following: every new paper from a PI you care about</li>
              <li>· Manuscript / preprint / published version tagging on every card</li>
            </ul>
          </div>
          <div className="bg-bg-card rounded-2xl border border-stroke p-6 shadow-sm">
            <div className="text-eyebrow font-semibold text-jewel-emerald uppercase tracking-wider mb-3">
              What it isn't
            </div>
            <ul className="space-y-3 text-[14px] font-serif text-text-primary/85">
              <li>
                <strong>Not a chatbot.</strong> It doesn't answer questions
                about papers — it brings you the right ones.
              </li>
              <li>
                <strong>Not a replacement for reading.</strong> The audio is
                the orientation; the abstracts and full-text are still the work.
              </li>
              <li>
                <strong>Not a social network.</strong> No likes, no shares.
                A future social layer will be gated by ORCID verification.
              </li>
              <li>
                <strong>Not a hedge against missing things.</strong> It's
                opinionated. If a paper isn't in your interests, it won't surface.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────
// Final CTA
// ─────────────────────────────────────────────────────────────────
function FinalCTA() {
  return (
    <section className="border-t border-stroke">
      <div className="max-w-3xl mx-auto px-6 py-20 text-center">
        <div className="text-eyebrow font-semibold text-jewel-topaz uppercase tracking-wider mb-3">
          Alpha — invite only
        </div>
        <h2 className="font-serif text-[36px] sm:text-[44px] font-semibold leading-tight mb-4">
          Ready to reshape your morning?
        </h2>
        <p className="font-serif text-[17px] leading-relaxed text-text-primary/85 mb-8">
          We're onboarding small cohorts so the model has time to learn each
          person's interests. Drop your email and we'll send a token when the
          next slot opens.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link to="/" className="rounded-full bg-jewel-emerald text-white font-semibold px-6 py-3 text-base shadow-sm hover:shadow-md transition">
            Request a token →
          </Link>
          <Link to="/" className="rounded-full bg-bg-card text-text-primary font-medium px-5 py-3 text-base border border-stroke">
            Sign in
          </Link>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="max-w-6xl mx-auto px-6 py-10 border-t border-stroke text-caption text-text-secondary text-center">
      © Joshua A. Fein 2026
    </footer>
  );
}

// ─────────────────────────────────────────────────────────────────
// Tiny inline icons
// ─────────────────────────────────────────────────────────────────
function CoffeeIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3F7A5C" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8h14v6a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V8z" />
      <path d="M17 10h2a3 3 0 0 1 0 6h-2" />
      <path d="M6 4v2M9 4v2M12 4v2" />
    </svg>
  );
}
function PhoneIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3F7A5C" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="6" y="2" width="12" height="20" rx="2.5" />
      <line x1="11" y1="18" x2="13" y2="18" />
    </svg>
  );
}
function StarIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="#B89039" stroke="#B89039" strokeWidth="1.5" strokeLinejoin="round">
      <polygon points="12 2 15 9 22 9.5 17 14.5 18.5 22 12 18 5.5 22 7 14.5 2 9.5 9 9" />
    </svg>
  );
}
