import { useEffect, useState } from "react";
import { Routes, Route, Navigate, NavLink, useLocation } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./lib/supabase";
import AuthPage from "./pages/AuthPage";
import TourPage from "./pages/TourPage";
import FeedPage from "./pages/FeedPage";
import PaperDetailPage from "./pages/PaperDetailPage";
import BriefingPage from "./pages/BriefingPage";
import SettingsPage from "./pages/SettingsPage";
import SeedsPage from "./pages/SeedsPage";
import JournalsPage from "./pages/JournalsPage";
import PinnedPage from "./pages/PinnedPage";
import AdminPage from "./pages/AdminPage";
import AdminUserDetailPage from "./pages/AdminUserDetailPage";
import OnboardingPage from "./pages/OnboardingPage";
import ConstellationPage from "./pages/ConstellationPage";
import AddPaperPage from "./pages/AddPaperPage";
import TocPage from "./pages/TocPage";
import ReadingPage from "./pages/ReadingPage";
import SearchModal from "./components/SearchModal";

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState<boolean | null>(null);
  // Subscribe to router location so unauthenticated /tour navigation
  // re-renders App and bypasses the auth gate via the check below.
  const location = useLocation();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Detect first-time users and route them through /welcome. We treat
  // "no interest_text AND no suggested_journals" as onboarding-needed
  // so existing users who already have either signal aren't disrupted.
  useEffect(() => {
    if (!session) { setNeedsOnboarding(null); return; }
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("interest_text,suggested_journals")
        .maybeSingle();
      const hasInterest = !!(data?.interest_text || "").trim();
      const journals = (data?.suggested_journals as unknown[]) || [];
      const hasJournals = journals.length > 0;
      setNeedsOnboarding(!(hasInterest || hasJournals));
    })();
  }, [session]);

  // Cmd/Ctrl+K opens the global search anywhere in the app.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((s) => !s);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (loading) {
    return (
      <div className="app-shell flex items-center justify-center bg-bg-primary">
        <div className="text-text-secondary text-sm">Loading…</div>
      </div>
    );
  }

  // Public /tour — bypasses auth gate so it can be linked / shared.
  if (location.pathname === "/tour") return <TourPage />;

  if (!session) return <AuthPage />;

  // Wait for the onboarding check to complete before rendering routes —
  // otherwise a brand-new user briefly sees the empty Feed before being
  // redirected, which feels broken.
  if (needsOnboarding === null) {
    return (
      <div className="app-shell flex items-center justify-center bg-bg-primary">
        <div className="text-text-secondary text-sm">Loading…</div>
      </div>
    );
  }

  return (
    <div className="bg-bg-primary min-h-screen">
      {/* Desktop layout = sticky left sidebar + wide main column.
          Mobile layout = main column only, bottom TabBar reappears. */}
      <div className="lg:flex lg:gap-0">
        <DesktopSidebar onSearch={() => setSearchOpen(true)} />
        <main className="flex-1 pb-24 lg:pb-12 lg:min-h-screen">
          <Routes>
            <Route path="/welcome" element={<OnboardingPage />} />
            <Route path="/tour" element={<TourPage />} />
            <Route
              path="/"
              element={needsOnboarding ? <Navigate to="/welcome" replace /> : <FeedPage />}
            />
            <Route path="/paper/:id" element={<PaperDetailPage />} />
            <Route path="/briefing" element={<BriefingPage />} />
            <Route path="/library" element={<PinnedPage />} />
            <Route path="/library/add" element={<AddPaperPage />} />
            {/* /latest retired — TOC covers the same need with more value. */}
            <Route path="/latest" element={<Navigate to="/toc" replace />} />
            <Route path="/toc" element={<TocPage />} />
            <Route path="/reading" element={<ReadingPage />} />
            <Route path="/constellation" element={<ConstellationPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/settings/seeds" element={<SeedsPage />} />
            <Route path="/settings/journals" element={<JournalsPage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/admin/:userId" element={<AdminUserDetailPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
      <MobileTabBar />
      {searchOpen && <SearchModal onClose={() => setSearchOpen(false)} />}
    </div>
  );
}

const NAV_ITEMS = [
  { to: "/", label: "Feed", icon: "📰", match: (p: string) => p === "/" || p.startsWith("/paper") },
  { to: "/toc", label: "Journals", icon: "📑", match: (p: string) => p.startsWith("/toc") },
  { to: "/briefing", label: "Briefing", icon: "🎧", match: (p: string) => p.startsWith("/briefing") },
  { to: "/reading", label: "Reading", icon: "📖", match: (p: string) => p.startsWith("/reading") },
  { to: "/library", label: "Library", icon: "★", match: (p: string) => p.startsWith("/library") },
  { to: "/settings", label: "Settings", icon: "⚙︎", match: (p: string) => p.startsWith("/settings") },
];

function DesktopSidebar({ onSearch }: { onSearch: () => void }) {
  const { pathname } = useLocation();
  return (
    <aside className="hidden lg:flex flex-col w-60 shrink-0 border-r border-stroke bg-bg-primary sticky top-0 h-screen px-4 py-6">
      <Link to="/" className="flex items-center gap-2 mb-8 px-2">
        <img src="/logo.svg" alt="" className="w-8 h-8 rounded-lg" />
        <span className="font-serif font-semibold text-[17px] tracking-tight">
          Lit Companion
        </span>
      </Link>
      <button
        onClick={onSearch}
        className="flex items-center gap-2 px-3 py-2 mb-4 text-sm text-text-secondary bg-bg-card rounded-xl border border-stroke hover:border-jewel-emerald/40 transition"
      >
        <span>⌕</span>
        <span className="flex-1 text-left">Search</span>
        <kbd className="text-[10px] font-mono bg-bg-primary border border-stroke rounded px-1.5 py-0.5">⌘K</kbd>
      </button>
      <nav className="flex flex-col gap-0.5">
        {NAV_ITEMS.map((t) => {
          const active = t.match(pathname);
          return (
            <NavLink
              key={t.to}
              to={t.to}
              className={`flex items-center gap-3 px-3 py-2 rounded-xl text-[14px] font-medium transition ${
                active
                  ? "bg-jewel-emerald/12 text-jewel-emerald"
                  : "text-text-secondary hover:text-text-primary hover:bg-bg-card"
              }`}
            >
              <span className="text-lg leading-none w-5 text-center">{t.icon}</span>
              <span>{t.label}</span>
            </NavLink>
          );
        })}
      </nav>
      <div className="mt-auto text-caption text-text-secondary/60 px-3">
        <Link to="/admin" className="hover:text-text-secondary">Admin</Link>
      </div>
    </aside>
  );
}

function Link({ to, children, className }: { to: string; children: React.ReactNode; className?: string }) {
  return <NavLink to={to} className={className}>{children}</NavLink>;
}

function MobileTabBar() {
  const { pathname } = useLocation();
  // All NAV_ITEMS are mobile-friendly now that /latest and Constellation
  // are pruned from the bottom bar. Constellation lives in Settings.
  const tabs = NAV_ITEMS;
  return (
    <nav className="tab-bar fixed bottom-0 inset-x-0 bg-bg-primary/95 backdrop-blur border-t border-stroke z-10 lg:hidden">
      <div className="max-w-lg mx-auto flex">
        {tabs.map((t) => {
          const active = t.match(pathname);
          return (
            <NavLink
              key={t.to}
              to={t.to}
              className={`flex-1 flex flex-col items-center py-2 text-[11px] font-medium ${
                active ? "text-jewel-emerald" : "text-text-secondary"
              }`}
            >
              <span className="text-lg leading-none">{t.icon}</span>
              <span className="mt-1">{t.label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
