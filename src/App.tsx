import { useEffect, useState } from "react";
import { Routes, Route, Navigate, NavLink, useLocation } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./lib/supabase";
import AuthPage from "./pages/AuthPage";
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
import SearchModal from "./components/SearchModal";

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState<boolean | null>(null);

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
    <div className="app-shell bg-bg-primary">
      <main className="pb-24">
        <Routes>
          <Route path="/welcome" element={<OnboardingPage />} />
          <Route
            path="/"
            element={needsOnboarding ? <Navigate to="/welcome" replace /> : <FeedPage />}
          />
          <Route path="/paper/:id" element={<PaperDetailPage />} />
          <Route path="/briefing" element={<BriefingPage />} />
          <Route path="/library" element={<PinnedPage />} />
          <Route path="/constellation" element={<ConstellationPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/settings/seeds" element={<SeedsPage />} />
          <Route path="/settings/journals" element={<JournalsPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/admin/:userId" element={<AdminUserDetailPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <TabBar />
      {searchOpen && <SearchModal onClose={() => setSearchOpen(false)} />}
    </div>
  );
}

function TabBar() {
  const { pathname } = useLocation();
  const tabs = [
    { to: "/", label: "Feed", icon: "📰" },
    { to: "/briefing", label: "Briefing", icon: "🎧" },
    { to: "/library", label: "Library", icon: "★" },
    { to: "/settings", label: "Settings", icon: "⚙︎" },
  ];
  return (
    <nav className="tab-bar fixed bottom-0 inset-x-0 bg-bg-primary/95 backdrop-blur border-t border-stroke z-10">
      <div className="max-w-lg mx-auto flex">
        {tabs.map((t) => {
          const active =
            t.to === "/"
              ? pathname === "/" || pathname.startsWith("/paper")
              : pathname.startsWith(t.to);
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
