import { useRef, useState } from "react";

// Generic swipeable row. Wraps any child content; reveals an action pad
// when the user drags horizontally past a small threshold, and fires the
// callback when they pass the commit threshold or tap the revealed pad.
//
// Mental model:
//   swipe LEFT  → "destructive / off-list" action revealed on the right
//   swipe RIGHT → "save / pin" action revealed on the left
//
// Both directions are optional. If only one is supplied, the other axis
// is inert (so a feed card with onSwipeRight={pin} can't be unpinned by
// dragging the wrong way).

interface Action {
  label: string;
  /** Tailwind background class — used for both the pad and accent. */
  bg: string;
  onCommit: () => void | Promise<void>;
}

const COMMIT_PX = 80;        // past this, release commits
const REVEAL_PX = 40;        // past this, the action pad becomes visible
const MAX_PX = 140;          // stop translating past this so it doesn't fly

export default function SwipeRow({
  children,
  swipeLeft,
  swipeRight,
  onTap,
}: {
  children: React.ReactNode;
  swipeLeft?: Action;
  swipeRight?: Action;
  /** If provided, a click without horizontal drag fires this. Useful for
   *  rows that aren't already wrapped in a Link. */
  onTap?: () => void;
}) {
  const [delta, setDelta] = useState(0);
  const [committed, setCommitted] = useState(false);
  const startX = useRef<number | null>(null);
  const moved = useRef(false);

  function clamp(d: number): number {
    if (d > 0 && !swipeRight) return 0;
    if (d < 0 && !swipeLeft) return 0;
    return Math.max(-MAX_PX, Math.min(MAX_PX, d));
  }

  function start(x: number) {
    startX.current = x;
    moved.current = false;
  }
  function move(x: number) {
    if (startX.current == null) return;
    const d = x - startX.current;
    if (Math.abs(d) > 4) moved.current = true;
    setDelta(clamp(d));
  }
  async function end() {
    if (startX.current == null) return;
    startX.current = null;
    const d = delta;
    setDelta(0);
    if (Math.abs(d) >= COMMIT_PX) {
      const action = d < 0 ? swipeLeft : swipeRight;
      if (action) {
        setCommitted(true);
        try { await action.onCommit(); } finally { setCommitted(false); }
      }
    }
  }

  // Tap support: only fire onTap if there was no horizontal drag.
  function handleClick(e: React.MouseEvent) {
    if (moved.current) { e.preventDefault(); e.stopPropagation(); return; }
    onTap?.();
  }

  const showRight = delta < -REVEAL_PX && swipeLeft;
  const showLeft = delta > REVEAL_PX && swipeRight;

  return (
    <div className="relative overflow-hidden rounded-card">
      {/* Right-side pad (revealed by swipe LEFT) */}
      {swipeLeft && (
        <button
          onClick={async (e) => {
            e.stopPropagation();
            setCommitted(true);
            try { await swipeLeft.onCommit(); } finally { setCommitted(false); }
          }}
          aria-label={swipeLeft.label}
          className={`absolute inset-y-0 right-0 flex items-center justify-end pr-5 text-white text-sm font-semibold transition-opacity ${swipeLeft.bg} ${showRight ? "opacity-100" : "opacity-0"}`}
          style={{ width: MAX_PX, pointerEvents: showRight ? "auto" : "none" }}
        >
          {swipeLeft.label}
        </button>
      )}
      {/* Left-side pad (revealed by swipe RIGHT) */}
      {swipeRight && (
        <button
          onClick={async (e) => {
            e.stopPropagation();
            setCommitted(true);
            try { await swipeRight.onCommit(); } finally { setCommitted(false); }
          }}
          aria-label={swipeRight.label}
          className={`absolute inset-y-0 left-0 flex items-center pl-5 text-white text-sm font-semibold transition-opacity ${swipeRight.bg} ${showLeft ? "opacity-100" : "opacity-0"}`}
          style={{ width: MAX_PX, pointerEvents: showLeft ? "auto" : "none" }}
        >
          {swipeRight.label}
        </button>
      )}
      <div
        onClick={handleClick}
        onTouchStart={(e) => start(e.touches[0].clientX)}
        onTouchMove={(e) => move(e.touches[0].clientX)}
        onTouchEnd={end}
        onTouchCancel={() => { startX.current = null; setDelta(0); }}
        onMouseDown={(e) => start(e.clientX)}
        onMouseMove={(e) => { if (startX.current != null) move(e.clientX); }}
        onMouseUp={end}
        onMouseLeave={() => { if (startX.current != null) end(); }}
        style={{
          transform: `translateX(${delta}px)`,
          transition: startX.current ? "none" : "transform 220ms cubic-bezier(0.2, 0.9, 0.3, 1)",
          opacity: committed ? 0.4 : 1,
        }}
      >
        {children}
      </div>
    </div>
  );
}
