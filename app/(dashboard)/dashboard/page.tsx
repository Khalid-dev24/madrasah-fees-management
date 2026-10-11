import Link from "next/link";
import { BriefcaseBusiness, DollarSign, TrendingUp, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoneyKobo } from "@/lib/fees/money";
import { requireAuth } from "@/lib/auth/session";
import { getFinancePageData } from "@/server/financial-service";

function formatCollectionRate(collected: bigint, expected: bigint): string {
  if (expected === 0n) {
    return "—";
  }
  const basisPoints = (collected * 10_000n) / expected;
  return `${basisPoints / 100n}.${(basisPoints % 100n).toString().padStart(2, "0")}%`;
}

export default async function DashboardPage() {
  await requireAuth();
  const data = await getFinancePageData();
  const currentQuarter = data.quarters.find((quarter) => quarter.is_current);
  const monthsInQuarter = new Set(
    data.months
      .filter((month) => month.quarter_id === currentQuarter?.id)
      .map((month) => month.id),
  );
  const quarterBalances = data.allBalances.filter((balance) => monthsInQuarter.has(balance.month_id));
  const quarterObligationIds = new Set(quarterBalances.map((balance) => balance.id));
  const expected = quarterBalances.reduce((total, balance) => total + BigInt(balance.expected_kobo), 0n);
  const collected = data.allocations
    .filter((allocation) => quarterObligationIds.has(allocation.obligation_id))
    .reduce((total, allocation) => total + BigInt(allocation.allocated_kobo), 0n);
  const outstanding = data.allBalances.reduce(
    (total, balance) => total + BigInt(balance.outstanding_kobo),
    0n,
  );
  const outstandingByStudent = new Map<string, bigint>();
  for (const balance of data.outstanding) {
    outstandingByStudent.set(
      balance.student_id,
      (outstandingByStudent.get(balance.student_id) ?? 0n) + BigInt(balance.outstanding_kobo),
    );
  }
  const topDebtors = [...outstandingByStudent.entries()]
    .sort((left, right) => left[1] === right[1] ? 0 : left[1] > right[1] ? -1 : 1)
    .slice(0, 5);
  const studentNames = new Map(data.students.map((student) => [student.id, student.full_name]));
  const periodLabel = currentQuarter?.name ?? "No current quarter";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-emerald-700">Overview</p>
          <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
        </div>
        <Badge variant="success">{periodLabel}</Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expected</CardTitle>
            <DollarSign className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatMoneyKobo(expected)}</div>
            <p className="text-xs text-slate-500">Quarter monthly obligations, before family-level discount</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Collected</CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatMoneyKobo(collected)}</div>
            <p className="text-xs text-slate-500">Valid payment allocations to this quarter&apos;s obligations</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Outstanding</CardTitle>
            <BriefcaseBusiness className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatMoneyKobo(outstanding)}</div>
            <p className="text-xs text-slate-500">All unpaid monthly obligations, including arrears</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Collection rate</CardTitle>
            <Users className="h-4 w-4 text-sky-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCollectionRate(collected, expected)}</div>
            <p className="text-xs text-slate-500">Quarter obligation allocation rate</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Quick actions</CardTitle>
            <CardDescription>Most common operational tasks.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <Button asChild className="justify-start"><Link href="/students">View students</Link></Button>
            <Button asChild variant="outline" className="justify-start"><Link href="/payments">Record payment</Link></Button>
            <Button asChild variant="outline" className="justify-start"><Link href="/outstanding">View outstanding</Link></Button>
            <Button asChild variant="outline" className="justify-start"><Link href="/reports">Generate report</Link></Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Available credits</CardTitle>
            <CardDescription>Unconsumed payment overages, stored as integer kobo.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.credits.length === 0 && <p className="text-sm text-slate-500">No available credits.</p>}
            {data.credits.slice(0, 4).map((credit) => {
              const owner = credit.student_id
                ? studentNames.get(credit.student_id)
                : data.families.find((family) => family.id === credit.family_id)?.family_name;
              return (
                <div key={credit.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
                  <span className="text-sm text-slate-700">{owner ?? "Unknown owner"}</span>
                  <strong className="text-sm">{formatMoneyKobo(credit.remaining_kobo)}</strong>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Students with outstanding fees</CardTitle>
          <CardDescription>Oldest unpaid obligation and derived total outstanding.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {topDebtors.map(([studentId, amount]) => {
              const oldest = data.outstanding.find((balance) => balance.student_id === studentId);
              return (
                <div key={studentId} className="flex items-center justify-between rounded-xl border border-slate-200 p-3">
                  <div>
                    <div className="font-medium text-slate-800">{studentNames.get(studentId) ?? "Unknown student"}</div>
                    <div className="text-sm text-slate-500">Oldest unpaid due: {oldest?.due_date ?? "—"}</div>
                  </div>
                  <div className="text-right font-semibold text-slate-900">{formatMoneyKobo(amount)}</div>
                </div>
              );
            })}
            {topDebtors.length === 0 && <p className="text-sm text-slate-500">No unpaid balances.</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
