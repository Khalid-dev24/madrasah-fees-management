import Link from "next/link";

export default function RootPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-emerald-50 p-6">
      <div className="max-w-lg rounded-2xl border border-emerald-100 bg-white p-8 text-center shadow-lg">
        <p className="text-sm uppercase tracking-[0.2em] text-emerald-700">Dārul Bayān</p>
        <h1 className="mt-3 text-3xl font-bold text-slate-900">Fee Management Portal</h1>
        <p className="mt-3 text-slate-600">Access the internal dashboard for student fees, family balances, and configured school settings.</p>
        <div className="mt-6 flex justify-center gap-3">
          <Link href="/login" className="rounded-md bg-emerald-600 px-4 py-2 font-medium text-white">Login</Link>
          <Link href="/dashboard" className="rounded-md border border-slate-200 px-4 py-2 font-medium text-slate-700">Open dashboard</Link>
        </div>
      </div>
    </main>
  );
}
