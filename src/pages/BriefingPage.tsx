import { useEffect, useRef, useState } from "react";
import { supabase, signedAudioURL } from "../lib/supabase";
import type { Briefing } from "../lib/types";

export default function BriefingPage() {
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [audioURL, setAudioURL] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
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
      setBriefing(data as Briefing);
      if (data?.audio_path) {
        try {
          const url = await signedAudioURL(data.audio_path);
          setAudioURL(url);
        } catch (e: any) {
          setError(`Audio URL: ${e.message}`);
        }
      }
    })();
  }, []);

  return (
    <div className="max-w-lg mx-auto px-6 pt-10">
      <div className="text-eyebrow font-semibold text-text-secondary uppercase tracking-wider">
        {briefing?.briefing_date || "Today's briefing"}
      </div>
      <h1 className="mt-2 text-[36px] font-semibold leading-tight text-text-primary">
        Today's
        <br />
        Briefing
      </h1>

      {/* Player */}
      <div className="mt-8 flex flex-col items-center">
        <div className="relative w-56 h-56 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border border-accent/30" />
          <div className="absolute inset-5 rounded-full bg-bg-card border border-stroke" />
          <button
            onClick={() => {
              const a = audioRef.current;
              if (!a) return;
              if (a.paused) a.play();
              else a.pause();
            }}
            className="relative z-10 w-20 h-20 rounded-full bg-accent text-white text-2xl flex items-center justify-center active:opacity-80"
            aria-label="Play / pause"
          >
            ▶
          </button>
        </div>

        {audioURL ? (
          <audio
            ref={audioRef}
            src={audioURL}
            controls
            preload="metadata"
            className="mt-6 w-full"
          />
        ) : (
          <p className="mt-6 text-caption text-text-secondary">
            {briefing
              ? "No audio for this briefing yet."
              : "No briefing yet — the pipeline generates one nightly."}
          </p>
        )}
      </div>

      {/* Transcript */}
      {briefing?.transcript && (
        <section className="mt-10">
          <div className="text-eyebrow font-semibold text-text-secondary uppercase tracking-wider">
            TRANSCRIPT
          </div>
          <pre className="mt-3 whitespace-pre-wrap text-[15px] leading-relaxed text-text-primary font-sans">
            {briefing.transcript}
          </pre>
        </section>
      )}

      {error && <div className="mt-6 text-sm text-red-600">{error}</div>}
    </div>
  );
}
