import type { ReactNode } from "react";
import { Suspense } from "react";
import { connection } from "next/server";
import { Menu } from "lucide-react";

import { logout } from "@/app/actions/auth";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { requireAuth } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";

function DashboardFallback() {
  return <div className="min-h-screen bg-slate-100" aria-busy="true" />;
}

async function AuthenticatedDashboard({ children }: { children: ReactNode }) {
  await connection();
  const session = await requireAuth();

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="flex min-h-screen">
        <AppSidebar />

        <div className="flex-1">
          <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-4 lg:px-8">
            <div className="flex items-center gap-3">
              <button className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 lg:hidden" aria-label="Open menu">
                <Menu className="h-4 w-4" />
              </button>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Internal portal</p>
                <h2 className="text-lg font-semibold text-slate-900">Madrasah operations</h2>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden rounded-full border border-slate-200 bg-slate-100 px-3 py-1.5 text-sm text-slate-700 md:block">
                {session.role}
              </div>
              <div className="text-sm text-slate-600">{session.name}</div>
              <form action={logout}>
                <Button type="submit" variant="outline" size="sm">Logout</Button>
              </form>
            </div>
          </header>

          <main className="p-4 lg:p-8">{children}</main>
        </div>
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<DashboardFallback />}>
      <AuthenticatedDashboard>{children}</AuthenticatedDashboard>
    </Suspense>
  );
}
