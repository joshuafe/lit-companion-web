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

const SPEEDS = [1, 1.25, 1.5, 1.75, 2];
const SKIP_SEC = 15;

function fmtTime(sec: number): string {
  if (!isFinite(sec)) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function BriefingPage() {
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [papersById, setPapersById] = useState<Record<string, Paper>>({});
  const [audioURL, setAudioURL] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pinFlash, setPinFlash] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speedIdx, setSpeedIdx] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const scrubberRef = useRef<HTMLDivElement | null>(null);

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
          .from("papers").select().in("source_id", b.paper_ids);
        const byId: Record<string, Paper> = {};
        for (const p of (papers as Paper[]) || []) byId[p.source_id] = p;
        setPapersById(byId);
      }
    })();
  }, []);

  const paperBlocks: PaperBlock[] = useMemo(
    () => (briefing?.script_json?.paper_blocks as PaperBlock[]) || [],
    [briefing],
  );
  const audioDuration = duration ||
    Number(briefing?.script_json?.audio_duration) || 0;

  // Active paper block by current playhead.
  const activeBlockIdx = useMemo(() => {
    for (let i = 0; i < paperBlocks.length; i++) {
      const b = paperBlocks[i];
      if (
        typeof b.start_seconds === "number" &&
        typeof b.end_seconds === "number" &&
        currentTime >= b.start_seconds &&
        currentTime < b.end_seconds
      ) {
        return i;
      }
    }
    return -1;
  }, [paperBlocks, currentTime]);
  const activeBlock = activeBlockIdx >= 0 ? paperBlocks[activeBlockIdx] : null;
  const activePaper = activeBlock ? papersById[activeBlock.paper_id] : null;

  // MediaSession metadata
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    const title = activePaper?.title || "Today's Briefing";
    const artist = activePaper?.journal || "Literature Companion";
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title, artist, album: briefing?.briefing_date || "",
        artwork: [
          { src: "/logo.svg", sizes: "512x512", type: "image/svg+xml" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
        ],
      });
    } catch {}
  }, [activePaper, briefing]);

  useEffect(() => {
    if (!("mediaSession" in navigator) || !audioRef.current) return;
    const a = audioRef.current;
    navigator.mediaSession.setActionHandler("play", () => a.play());
    navigator.mediaSession.setActionHandler("pause", () => a.pause());
    navigator.mediaSession.setActionHandler("seekbackward", (d) => {
      a.currentTime = Math.max(0, a.currentTime - (d.seekOffset || SKIP_SEC));
    });
    navigator.mediaSession.setActionHandler("seekforward", (d) => {
      a.currentTime = Math.min(a.duration, a.currentTime + (d.seekOffset || SKIP_SEC));
    });
    navigator.mediaSession.setActionHandler("nexttrack", () => seekToBlock(activeBlockIdx + 1));
    navigator.mediaSession.setActionHandler("previoustrack", () => seekToBlock(activeBlockIdx - 1));
    return () => {
      try {
        ["play", "pause", "seekbackward", "seekforward", "nexttrack", "previoustrack"]
          .forEach((k) => navigator.mediaSession.setActionHandler(k as any, null));
      } catch {}
    };
  }, [audioURL, activeBlockIdx, paperBlocks]);

  function togglePlay() {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) a.play(); else a.pause();
  }
  function skip(sec: number) {
    const a = audioRef.current;
    if (!a) return;
    a.currentTime = Math.max(0, Math.min(a.duration || audioDuration, a.currentTime + sec));
  }
  function seekTo(sec: number) {
    const a = audioRef.current;
    if (!a) return;
    a.currentTime = Math.max(0, Math.min(a.duration || audioDuration, sec));
  }
  function seekToBlock(idx: number) {
    const b = paperBlocks[idx];
    if (b && typeof b.start_seconds === "number") {
      seekTo(b.start_seconds);
      const a = audioRef.current;
      if (a && a.paused) a.play();
    }
  }
  function cycleSpeed() {
    const a = audioRef.current;
    if (!a) return;
    const next = (speedIdx + 1) % SPEEDS.length;
    setSpeedIdx(next);
    a.playbackRate = SPEEDS[next];
  }

  function handleScrubberClick(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    seekTo(pct * (audioDuration || 0));
  }

  async function skipActive() {
    if (!activeBlock || !activePaper) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error: err } = await supabase
      .from("dismissals")
      .upsert({ user_id: user.id, paper_id: activePaper.id });
    if (err) {
      setPinFlash(`Error: ${err.message}`);
      setTimeout(() => setPinFlash(null), 2000);
      return;
    }
    setPinFlash("Skipped — won't surface again");
    if (navigator.vibrate) navigator.vibrate(8);

    // Auto-continue at the next chapter. If there isn't one — i.e. the
    // user skipped the final paper — jump to the briefing's sign-off
    // so audio doesn't keep narrating the just-dismissed paper.
    const a = audioRef.current;
    const next = paperBlocks[activeBlockIdx + 1];
    if (next && typeof next.start_seconds === "number") {
      seekToBlock(activeBlockIdx + 1);
    } else if (a) {
      // No next chapter — skip to end of audio (sign-off if present).
      const signOff = (briefing?.script_json as any)?.section_timings?.sign_off?.start;
      if (typeof signOff === "number") {
        seekTo(signOff);
        if (a.paused) a.play();
      } else {
        // No sign-off timing either — just end gracefully.
        seekTo(audioDuration || 0);
        a.pause();
      }
    }
    setTimeout(() => setPinFlash(null), 2000);
  }

  async function pinActive() {
    if (!activeBlock || !activePaper) {
      setPinFlash("Tap a chapter to make it the active paper, then pin.");
      setTimeout(() => setPinFlash(null), 2200);
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error: err } = await supabase.from("pins").upsert(
      { user_id: user.id, paper_id: activePaper.id,
        note: `pinned at ${Math.round(currentTime)}s during briefing` },
      { onConflict: "user_id,paper_id" },
    );
    if (err) setPinFlash(`Error: ${err.message}`);
    else {
      setPinFlash(`★ Saved "${activePaper.title.slice(0, 52)}…"`);
      if (navigator.vibrate) navigator.vibrate([18, 30, 12]);
    }
    setTimeout(() => setPinFlash(null), 2400);
  }

  return (
    <div className="max-w-lg lg:max-w-3xl mx-auto px-6 lg:px-8 pt-10 pb-32">
      <div className="text-eyebrow font-semibold text-text-secondary uppercase tracking-wider">
        {briefing?.briefing_date || "Today's briefing"}
      </div>
      <h1 className="mt-2 text-[36px] font-semibold leading-tight text-text-primary">
        Today's<br/>Briefing
      </h1>

      {audioURL ? (
        <div className="mt-6 bg-bg-card rounded-2xl p-4 shadow-sm">
          {/* Now playing card */}
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="text-eyebrow font-semibold text-jewel-emerald uppercase tracking-wider">
                Now playing
              </div>
              <div className="font-serif text-[17px] leading-snug text-text-primary mt-1 line-clamp-2">
                {activePaper?.title || (activeBlockIdx === -1 && currentTime === 0 ? "Tap play to begin" : "Briefing intro")}
              </div>
              {activePaper?.journal && (
                <div className="text-caption text-text-secondary mt-0.5">
                  {activePaper.journal}
                </div>
              )}
            </div>
            <div className="shrink-0 flex flex-col gap-1.5">
              <button
                onClick={pinActive}
                disabled={!activePaper}
                className="rounded-full bg-jewel-topaz text-white font-semibold px-4 py-2 text-sm disabled:opacity-40"
                aria-label="Pin currently-playing paper"
              >
                ★ Pin
              </button>
              <button
                onClick={skipActive}
                disabled={!activePaper}
                className="rounded-full bg-bg-primary text-text-secondary font-medium px-3 py-1.5 text-[11px] disabled:opacity-40 hover:text-text-primary"
                aria-label="Skip this paper"
                title="Dismiss and jump to the next chapter"
              >
                Skip ↷
              </button>
            </div>
          </div>

          {/* Scrubber with chapter ticks */}
          <div className="mt-4">
            <div
              ref={scrubberRef}
              onClick={handleScrubberClick}
              className="relative h-2 bg-bg-primary rounded-full cursor-pointer group"
              role="slider"
              aria-valuemin={0}
              aria-valuemax={audioDuration}
              aria-valuenow={currentTime}
            >
              <div
                className="absolute inset-y-0 left-0 bg-jewel-emerald rounded-full"
                style={{ width: `${audioDuration ? (currentTime / audioDuration) * 100 : 0}%` }}
              />
              {/* chapter tick marks */}
              {paperBlocks.map((b, i) => {
                if (typeof b.start_seconds !== "number" || !audioDuration) return null;
                const pct = (b.start_seconds / audioDuration) * 100;
                const active = i === activeBlockIdx;
                return (
                  <div
                    key={i}
                    onClick={(e) => { e.stopPropagation(); seekToBlock(i); }}
                    className={`absolute top-1/2 -translate-y-1/2 w-1 h-3 rounded-sm cursor-pointer ${
                      active ? "bg-jewel-topaz" : "bg-text-primary/40"
                    } hover:bg-jewel-topaz`}
                    style={{ left: `calc(${pct}% - 2px)` }}
                    title={`Paper ${i + 1}`}
                  />
                );
              })}
            </div>
            <div className="flex justify-between mt-1 text-[11px] text-text-secondary font-mono">
              <span>{fmtTime(currentTime)}</span>
              <span>{fmtTime(audioDuration)}</span>
            </div>
          </div>

          {/* Transport */}
          <div className="mt-4 flex items-center justify-between gap-3">
            <button
              onClick={() => skip(-SKIP_SEC)}
              className="text-text-primary text-sm font-mono w-12 text-center"
              aria-label="Back 15 seconds"
            >
              −15
            </button>
            <button
              onClick={() => seekToBlock(activeBlockIdx - 1)}
              disabled={activeBlockIdx <= 0}
              className="text-text-primary text-xl disabled:opacity-30"
              aria-label="Previous chapter"
            >
              ⏮
            </button>
            <button
              onClick={togglePlay}
              className="w-14 h-14 rounded-full bg-jewel-emerald text-white text-xl flex items-center justify-center active:opacity-80 shadow-md"
              aria-label={playing ? "Pause" : "Play"}
            >
              {playing ? "❚❚" : "▶"}
            </button>
            <button
              onClick={() => seekToBlock(activeBlockIdx + 1)}
              disabled={activeBlockIdx >= paperBlocks.length - 1}
              className="text-text-primary text-xl disabled:opacity-30"
              aria-label="Next chapter"
            >
              ⏭
            </button>
            <button
              onClick={() => skip(SKIP_SEC)}
              className="text-text-primary text-sm font-mono w-12 text-center"
              aria-label="Forward 15 seconds"
            >
              +15
            </button>
            <button
              onClick={cycleSpeed}
              className="text-jewel-topaz text-sm font-semibold w-10 text-center"
              aria-label="Playback speed"
            >
              {SPEEDS[speedIdx]}×
            </button>
          </div>

          <audio
            ref={audioRef}
            src={audioURL}
            preload="metadata"
            onTimeUpdate={(e) => setCurrentTime((e.target as HTMLAudioElement).currentTime)}
            onLoadedMetadata={(e) => setDuration((e.target as HTMLAudioElement).duration)}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            className="hidden"
          />

          {pinFlash && (
            <div className="mt-3 text-caption text-jewel-topaz text-center font-medium">{pinFlash}</div>
          )}
        </div>
      ) : (
        <div className="mt-8 bg-bg-card rounded-2xl p-6 text-center text-caption text-text-secondary">
          {briefing
            ? "No audio for today's briefing yet."
            : "No briefing yet — the pipeline generates one each morning."}
        </div>
      )}

      {/* Chapter transcript — each paper as tappable card with seek */}
      {paperBlocks.length > 0 && (
        <section className="mt-8">
          <div className="text-eyebrow font-semibold text-text-secondary uppercase tracking-wider mb-3">
            Chapters
          </div>
          <ul className="space-y-2">
            {briefing?.script_json?.greeting && (
              <ChapterRow
                label="Greeting"
                start={0}
                active={currentTime < (paperBlocks[0]?.start_seconds || 999)}
                onSeek={() => seekTo(0)}
                body={briefing.script_json.greeting}
                muted
              />
            )}
            {paperBlocks.map((b, i) => {
              const p = papersById[b.paper_id];
              const isActive = i === activeBlockIdx;
              return (
                <ChapterRow
                  key={i}
                  label={p?.journal || `Paper ${i + 1}`}
                  title={p?.title || b.intro_phrase || ""}
                  start={b.start_seconds || 0}
                  active={isActive}
                  onSeek={() => seekToBlock(i)}
                  body={b.body || ""}
                />
              );
            })}
          </ul>
        </section>
      )}

      {error && <div className="mt-6 text-sm text-red-600">{error}</div>}
    </div>
  );
}

function ChapterRow({
  label, title, start, active, onSeek, body, muted,
}: {
  label: string;
  title?: string;
  start: number;
  active: boolean;
  onSeek: () => void;
  body: string;
  muted?: boolean;
}) {
  return (
    <li>
      <button
        onClick={onSeek}
        className={`w-full text-left rounded-xl p-3 transition border ${
          active
            ? "bg-jewel-emerald/10 border-jewel-emerald/30"
            : "bg-bg-card border-transparent hover:border-stroke"
        }`}
      >
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-eyebrow font-semibold uppercase tracking-wider ${
            active ? "text-jewel-emerald" : "text-text-secondary"
          }`}>
            {label}
          </span>
          <span className="text-[10px] font-mono text-text-secondary/70 ml-auto">
            {fmtTime(start)}
          </span>
        </div>
        {title && (
          <div className={`font-serif text-[15px] leading-snug ${
            muted ? "text-text-secondary" : "text-text-primary"
          } line-clamp-2 mb-1`}>
            {title}
          </div>
        )}
        <p className={`font-serif text-[14px] leading-relaxed ${
          muted ? "text-text-secondary" : "text-text-primary/80"
        } line-clamp-3`}>
          {body}
        </p>
      </button>
    </li>
  );
}
