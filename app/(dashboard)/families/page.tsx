import Link from "next/link";

import { FamilyRecordForm } from "@/components/families/family-record-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoneyKobo } from "@/lib/fees/money";
import { requireAuth } from "@/lib/auth/session";
import { getFamilyPageData } from "@/server/financial-service";

export default async function FamiliesPage() {
  const session = await requireAuth();
  const { families, students, quarter, summary } = await getFamilyPageData();
  const summaryByFamily = new Map(summary.map((item) => [String(item.family_id), item]));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-emerald-700">Families</p>
          <h1 className="text-3xl font-bold text-slate-900">Family overview</h1>
          <p className="mt-1 text-sm text-slate-600">
            {quarter ? `Quarterly discount and balance summary for ${quarter.name}.` : "No current quarter is configured."}
          </p>
        </div>
        <Badge variant="outline">{families.length} families</Badge>
      </div>

      {session.role === "admin" && (
        <Card>
          <CardHeader><CardTitle>Add family</CardTitle></CardHeader>
          <CardContent><FamilyRecordForm /></CardContent>
        </Card>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        {families.map((family) => {
          const children = students.filter((student) => student.family_id === family.id);
          const data = summaryByFamily.get(family.id);
          return (
            <Card key={family.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle>{family.family_name}</CardTitle>
                    <CardDescription>
                      {family.primary_contact_name ?? "No primary contact"} · {family.phone ?? "No phone"}
                    </CardDescription>
                  </div>
                  <Badge variant={Number(data?.eligible_student_count ?? 0) >= 3 ? "success" : "outline"}>
                    {Number(data?.eligible_student_count ?? 0)} eligible
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg bg-slate-50 p-3">
                    <p className="text-slate-500">Quarter gross expected</p>
                    <p className="mt-1 font-semibold">{formatMoneyKobo(String(data?.expected_kobo ?? "0"))}</p>
                  </div>
                  <div className="rounded-lg bg-emerald-50 p-3">
                    <p className="text-slate-500">Quarterly family discount</p>
                    <p className="mt-1 font-semibold">{formatMoneyKobo(String(data?.discount_kobo ?? "0"))}</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3">
                    <p className="text-slate-500">Net expected</p>
                    <p className="mt-1 font-semibold">{formatMoneyKobo(String(data?.net_expected_kobo ?? "0"))}</p>
                  </div>
                  <div className="rounded-lg bg-amber-50 p-3">
                    <p className="text-slate-500">Outstanding</p>
                    <p className="mt-1 font-semibold">{formatMoneyKobo(String(data?.outstanding_kobo ?? "0"))}</p>
                  </div>
                </div>

                <div className="space-y-1">
                  {children.map((student) => (
                    <div key={student.id} className="flex justify-between text-sm">
                      <span className="text-slate-700">{student.full_name}</span>
                      <span className="text-slate-500">{student.status}</span>
                    </div>
                  ))}
                </div>
                <Link href={`/families/${family.id}`} className="inline-block text-sm font-medium text-emerald-700">
                  View family details
                </Link>
                {session.role === "admin" && (
                  <details className="mt-3 border-t border-slate-100 pt-3">
                    <summary className="cursor-pointer text-sm font-medium text-slate-700">Edit family information</summary>
                    <div className="mt-3">
                      <FamilyRecordForm family={family} />
                    </div>
                  </details>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
