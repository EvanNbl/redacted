"use client";

import { useState } from "react";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { AuthGate } from "./AuthGate";
import { AppNav } from "./AppNav";
import { PageTransition } from "./PageTransition";
import { LoadingScreen } from "./LoadingScreen";
import { ChangelogModal } from "./ChangelogModal";

function AppContent({ children }: { children: React.ReactNode }) {
  const { loading: authLoading } = useAuth();
  const [showLoader, setShowLoader] = useState(true);

  return (
    <>
      {showLoader && (
        <LoadingScreen
          loading={authLoading}
          onFinished={() => setShowLoader(false)}
        />
      )}
      <AuthGate>
        <div className="flex h-screen overflow-hidden bg-[#07070b]">
          <AppNav />
          <main className="flex-1 overflow-hidden">
            <PageTransition>{children}</PageTransition>
          </main>
        </div>
        <ChangelogModal />
      </AuthGate>
    </>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AppContent>{children}</AppContent>
    </AuthProvider>
  );
}
