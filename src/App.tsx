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

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

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

  if (loading) {
    return (
      <div className="app-shell flex items-center justify-center bg-bg-primary">
        <div className="text-text-secondary text-sm">Loading…</div>
      </div>
    );
  }

  if (!session) return <AuthPage />;

  return (
    <div className="app-shell bg-bg-primary">
      <main className="pb-24">
        <Routes>
          <Route path="/" element={<FeedPage />} />
          <Route path="/paper/:id" element={<PaperDetailPage />} />
          <Route path="/briefing" element={<BriefingPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/settings/seeds" element={<SeedsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <TabBar />
    </div>
  );
}

function TabBar() {
  const { pathname } = useLocation();
  const tabs = [
    { to: "/", label: "Feed", icon: "📰" },
    { to: "/briefing", label: "Briefing", icon: "🎧" },
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
                active ? "text-accent" : "text-text-secondary"
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
