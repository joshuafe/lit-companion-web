import { useEffect, useMemo, useRef, useState } from "react";
import { supabase, signedAudioURL } from "../lib/supabase";
import type { Briefing, Paper } from "../lib/types";

interface PaperBlock {
  paper_id: string;
  intro_phrase?: string;
  body?: string;
  start_seconds?: number;
  end_seconds?: number;
}

export default function BriefingPage() {
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [papersById, setPapersById] = useState<Record<string, Paper>>({});
  const [audioURL, setAudioURL] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pinFlash, setPinFlash] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error: err } = await supabase
        .from("briefings")
        .select()
        .order("briefing_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (err) setError(err.message);
      const b = data as Briefing | null;
      setBriefing(b);
      if (b?.audio_path) {
        try {
          const url = await signedAudioURL(b.audio_path);
          setAudioURL(url);
        } catch (e: any) {
          setError(`Audio URL: ${e.message}`);
        }
      }
      if (b?.paper_ids?.length) {
        const { data: papers } = await supabase
          .from("papers")
          .select()
          .in("source_id", b.paper_ids);
        const byId: Record<string, Paper> = {};
        for (const p of (papers as Paper[]) || []) {
          byId[p.source_id] = p;
        }
        setPapersById(byId);
      }
    })();
  }, []);

  const paperBlocks: PaperBlock[] = useMemo(
    () => (briefing?.script_json?.paper_blocks as PaperBlock[]) || [],
    [briefing],
  );

  // Which paper (by source_id) owns the current playhead?
  const activeBlock = useMemo(() => {
    for (const b of paperBlocks) {
      if (
        typeof b.start_seconds === "number" &&
        typeof b.end_seconds === "number" &&
        currentTime >= b.start_seconds &&
        currentTime < b.end_seconds
      ) {
        return b;
      }
    }
    return null;
  }, [paperBlocks, currentTime]);

  const activePaper = activeBlock ? papersById[activeBlock.paper_id] : null;

  // MediaSession metadata for lock-screen / notification display.
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    const title = activePaper?.title || "Today's Briefing";
    const artist = activePaper?.journal || "Literature Companion";
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title,
        artist,
        album: briefing?.briefing_date || "",
        artwork: [
          { src: "/logo.svg", sizes: "512x512", type: "image/svg+xml" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
        ],
      });
    } catch {
      /* browser may not support full MediaMetadata */
    }
  }, [activePaper, briefing]);

  // Wire MediaSession action handlers once audio is ready.
  useEffect(() => {
    if (!("mediaSession" in navigator) || !audioRef.current) return;
    const a = audioRef.current;
    navigator.mediaSession.setActionHandler("play", () => a.play());
    navigator.mediaSession.setActionHandler("pause", () => a.pause());
    navigator.mediaSession.setActionHandler("seekbackward", (d) => {
      a.currentTime = Math.max(0, a.currentTime - (d.seekOffset || 15));
    });
    navigator.mediaSession.setActionHandler("seekforward", (d) => {
      a.currentTime = Math.min(a.duration, a.currentTime + (d.seekOffset || 15));
    });
    return () => {
      try {
        navigator.mediaSession.setActionHandler("play", null);
        navigator.mediaSession.setActionHandler("pause", null);
        navigator.mediaSession.setActionHandler("seekbackward", null);
        navigator.mediaSession.setActionHandler("seekforward", null);
      } catch {}
    };
  }, [audioURL]);

  async function pinActive() {
    if (!activeBlock || !activePaper) {
      setPinFlash("No paper is playing right now.");
      setTimeout(() => setPinFlash(null), 2000);
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error: err } = await supabase.from("pins").upsert(
      {
        user_id: user.id,
        paper_id: activePaper.id,
        note: `pinned at ${Math.round(currentTime)}s during briefing`,
      },
      { onConflict: "user_id,paper_id" },
    );
    if (err) {
      setPinFlash(`Error: ${err.message}`);
    } else {
      setPinFlash(`★ Pinned "${activePaper.title.slice(0, 52)}…"`);
    }
    setTimeout(() => setPinFlash(null), 2400);
  }

  function togglePlay() {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) a.play();
    else a.pause();
  }

  return (
    <div className="max-w-lg mx-auto px-6 pt-10 pb-16">
      <div className="text-eyebrow font-semibold text-text-secondary uppercase tracking-wider">
        {briefing?.briefing_date || "Today's briefing"}
      </div>
      <h1 className="mt-2 text-[36px] font-semibold leading-tight text-text-primary">
        Today's
        <br />
        Briefing
      </h1>

      <div className="mt-8 flex flex-col items-center">
        <div className="relative w-56 h-56 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border border-accent/30" />
          <div className="absolute inset-5 rounded-full bg-bg-card border border-stroke" />
          <button
            onClick={togglePlay}
            className="relative z-10 w-20 h-20 rounded-full bg-jewel-emerald text-white text-2xl flex items-center justify-center active:opacity-80 shadow-lg shadow-jewel-emerald/25"
            aria-label={playing ? "Pause" : "Play"}
          >
            {playing ? "❚❚" : "▶"}
          </button>
        </div>

        {audioURL ? (
          <>
            <audio
              ref={audioRef}
              src={audioURL}
              controls
              preload="metadata"
              onTimeUpdate={(e) => setCurrentTime((e.target as HTMLAudioElement).currentTime)}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              className="mt-6 w-full"
            />

            {/* Active-paper label + pin button */}
            <div className="mt-4 w-full bg-bg-card rounded-2xl p-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-eyebrow font-semibold text-text-secondary uppercase tracking-wider">
                  Now playing
                </div>
                <div className="text-sm text-text-primary truncate mt-0.5">
                  {activePaper?.title || "Briefing intro"}
                </div>
                {activePaper?.journal && (
                  <div className="text-caption text-text-secondary truncate">
                    {activePaper.journal}
                  </div>
                )}
              </div>
              <button
                onClick={pinActive}
                disabled={!activePaper}
                className="shrink-0 rounded-full bg-jewel-topaz text-white font-semibold px-4 py-2 text-sm disabled:opacity-40 shadow-sm"
                aria-label="Pin currently-playing paper"
              >
                ★ Pin
              </button>
            </div>

            {pinFlash && (
              <div className="mt-2 text-caption text-accent">{pinFlash}</div>
            )}
          </>
        ) : (
          <p className="mt-6 text-caption text-text-secondary">
            {briefing
              ? "No audio for this briefing yet."
              : "No briefing yet — the pipeline generates one nightly."}
          </p>
        )}
      </div>

      {briefing?.transcript && (
        <section className="mt-10">
          <div className="text-eyebrow font-semibold text-text-secondary uppercase tracking-wider">
            TRANSCRIPT
          </div>
          <pre className="mt-3 whitespace-pre-wrap font-serif text-[16px] leading-relaxed text-text-primary">
            {briefing.transcript}
          </pre>
        </section>
      )}

      {error && <div className="mt-6 text-sm text-red-600">{error}</div>}
    </div>
  );
}
