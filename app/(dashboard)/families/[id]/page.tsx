import Link from "next/link";
import { notFound } from "next/navigation";

import { FamilyRecordForm } from "@/components/families/family-record-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoneyKobo } from "@/lib/fees/money";
import { requireAuth } from "@/lib/auth/session";
import { getFamilyDetailData } from "@/server/financial-service";

export default async function FamilyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth();
  const { id } = await params;
  const { family, students, balances } = await getFamilyDetailData(id);
  if (!family) {
    notFound();
  }

  const balancesByStudent = new Map<string, bigint>();
  for (const balance of balances) {
    balancesByStudent.set(
      balance.student_id,
      (balancesByStudent.get(balance.student_id) ?? 0n) + BigInt(balance.outstanding_kobo),
    );
  }
  const totalOutstanding = [...balancesByStudent.values()].reduce((total, value) => total + value, 0n);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-emerald-700">Family profile</p>
          <h1 className="text-3xl font-bold text-slate-900">{family.family_name}</h1>
        </div>
        <Link href="/families" className="text-sm font-medium text-emerald-700">Back to families</Link>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader><CardTitle>Family information</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div><p className="text-sm text-slate-500">Primary contact</p><p className="font-medium">{family.primary_contact_name ?? "—"}</p></div>
            <div><p className="text-sm text-slate-500">Phone</p><p className="font-medium">{family.phone ?? "—"}</p></div>
            <div><p className="text-sm text-slate-500">Email</p><p className="font-medium">{family.email ?? "—"}</p></div>
            <div><p className="text-sm text-slate-500">Address</p><p className="font-medium">{family.address ?? "—"}</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Family balance</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Badge variant="success">{students.length} children</Badge>
            <p className="text-sm text-slate-600">Unpaid monthly obligations: <strong>{formatMoneyKobo(totalOutstanding)}</strong></p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Children balances</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {students.map((student) => (
            <div key={student.id} className="flex items-center justify-between rounded-xl border border-slate-200 p-3">
              <div>
                <div className="font-medium text-slate-900">{student.full_name}</div>
                <div className="text-sm text-slate-500">{student.payment_frequency} · {student.status}</div>
              </div>
              <div className="font-semibold">{formatMoneyKobo(balancesByStudent.get(student.id) ?? 0n)}</div>
            </div>
          ))}
        </CardContent>
      </Card>

      {session.role === "admin" && (
        <Card>
          <CardHeader><CardTitle>Edit family record</CardTitle></CardHeader>
          <CardContent><FamilyRecordForm family={family} /></CardContent>
        </Card>
      )}
    </div>
  );
}
