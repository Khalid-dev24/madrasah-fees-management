import Link from "next/link";
import { BarChart3, CreditCard, FileText, GraduationCap, Home, Settings, UsersRound } from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/students", label: "Students", icon: GraduationCap },
  { href: "/families", label: "Families", icon: UsersRound },
  { href: "/payments", label: "Payments", icon: CreditCard },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/receipts", label: "Receipts", icon: FileText },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppSidebar() {
  return (
    <aside className="hidden w-72 border-r border-slate-200 bg-slate-50/70 p-5 lg:block">
      <div className="mb-8">
        <p className="text-xs uppercase tracking-[0.3em] text-emerald-700">Madrasah</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">Fee System</h1>
      </div>

      <nav className="space-y-2">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-emerald-50 hover:text-emerald-800"
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        ))}
      </nav>

      <div className="mt-10 rounded-2xl bg-emerald-600 p-4 text-white shadow-sm">
        <p className="text-xs uppercase tracking-[0.2em] text-emerald-100">Current period</p>
        <p className="mt-2 text-lg font-semibold">Q4 2026</p>
      </div>
    </aside>
  );
}
