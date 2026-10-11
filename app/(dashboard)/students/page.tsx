import Link from "next/link";

import { StudentRecordForm } from "@/components/students/student-record-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoneyKobo } from "@/lib/fees/money";
import { requireAuth } from "@/lib/auth/session";
import { getStudentsPageData } from "@/server/core-data";

type StudentsPageProps = {
  searchParams: Promise<{
    q?: string;
    class?: string;
    family?: string;
    status?: string;
    frequency?: string;
    page?: string;
  }>;
};

function pageHref(params: URLSearchParams, page: number): string {
  const next = new URLSearchParams(params);
  if (page <= 1) next.delete("page");
  else next.set("page", String(page));
  const query = next.toString();
  return query ? `/students?${query}` : "/students";
}

export default async function StudentsPage({ searchParams }: StudentsPageProps) {
  const session = await requireAuth();
  const params = await searchParams;
  const search = params.q?.trim() ?? "";
  const currentPage = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const data = await getStudentsPageData({
    search,
    classId: params.class ?? "",
    familyId: params.family ?? "",
    status: ["active", "inactive", "graduated", "withdrawn"].includes(params.status ?? "") ? params.status! : "",
    paymentFrequency: ["monthly", "quarterly"].includes(params.frequency ?? "") ? params.frequency! : "",
    page: currentPage,
  });
  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));
  const filterParams = new URLSearchParams();
  if (search) filterParams.set("q", search);
  if (params.class) filterParams.set("class", params.class);
  if (params.family) filterParams.set("family", params.family);
  if (params.status) filterParams.set("status", params.status);
  if (params.frequency) filterParams.set("frequency", params.frequency);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-emerald-700">Students</p>
          <h1 className="text-3xl font-bold text-slate-900">Student records</h1>
          <p className="mt-1 text-sm text-slate-600">Student and balance information loaded from Supabase.</p>
        </div>
        <Badge variant="outline">{data.total} students</Badge>
      </div>

      {session.role === "admin" && (
        <details className="rounded-2xl border border-slate-200 bg-white p-5">
          <summary className="cursor-pointer font-semibold text-slate-900">Add student</summary>
          <div className="mt-5">
            <StudentRecordForm families={data.families} classes={data.classes} />
          </div>
        </details>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Student directory</CardTitle>
          <CardDescription>Search by student name, parent/guardian name, or phone. Filter the directory and page through results.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action="/students" className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <input name="q" defaultValue={search} placeholder="Search students or parent" className="h-10 rounded-md border border-slate-200 px-3" />
            <select name="class" defaultValue={params.class ?? ""} className="h-10 rounded-md border border-slate-200 bg-white px-3">
              <option value="">All classes</option>
              {data.classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            <select name="family" defaultValue={params.family ?? ""} className="h-10 rounded-md border border-slate-200 bg-white px-3">
              <option value="">All families</option>
              {data.families.map((family) => <option key={family.id} value={family.id}>{family.family_name}</option>)}
            </select>
            <select name="status" defaultValue={params.status ?? ""} className="h-10 rounded-md border border-slate-200 bg-white px-3">
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="graduated">Graduated</option>
              <option value="withdrawn">Withdrawn</option>
            </select>
            <select name="frequency" defaultValue={params.frequency ?? ""} className="h-10 rounded-md border border-slate-200 bg-white px-3">
              <option value="">All payment frequencies</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
            </select>
            <div className="flex gap-2 sm:col-span-2 xl:col-span-5">
              <Button type="submit">Apply filters</Button>
              <Button asChild variant="outline"><Link href="/students">Clear</Link></Button>
            </div>
          </form>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="px-3 py-3">Student</th>
                  <th className="px-3 py-3">Class / family</th>
                  <th className="px-3 py-3">Monthly fee</th>
                  <th className="px-3 py-3">Frequency</th>
                  <th className="px-3 py-3">Paid</th>
                  <th className="px-3 py-3">Outstanding</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {data.students.map((student) => (
                  <tr key={student.id} className="border-b border-slate-100">
                    <td className="px-3 py-3">
                      <div className="font-medium text-slate-900">{student.full_name}</div>
                      <div className="text-xs text-slate-500">{student.parent_name ?? "No parent contact"} · {student.parent_phone ?? "No phone"}</div>
                    </td>
                    <td className="px-3 py-3">{student.class_name}<div className="text-xs text-slate-500">{student.family_name}</div></td>
                    <td className="px-3 py-3">{formatMoneyKobo(student.monthly_fee_kobo)}</td>
                    <td className="px-3 py-3 capitalize">{student.payment_frequency}</td>
                    <td className="px-3 py-3">{formatMoneyKobo(student.paid_kobo)}</td>
                    <td className="px-3 py-3 font-medium">{formatMoneyKobo(student.outstanding_kobo)}</td>
                    <td className="px-3 py-3"><Badge variant={student.status === "active" ? "success" : "warning"}>{student.status}</Badge></td>
                    <td className="px-3 py-3"><Link href={`/students/${student.id}`} className="font-medium text-emerald-700">View</Link></td>
                  </tr>
                ))}
                {data.students.length === 0 && <tr><td colSpan={8} className="px-3 py-8 text-center text-slate-500">No students match these filters.</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex items-center justify-between text-sm">
            <span className="text-slate-500">Page {Math.min(currentPage, totalPages)} of {totalPages}</span>
            <div className="flex gap-2">
              {currentPage <= 1
                ? <Button variant="outline" size="sm" disabled>Previous</Button>
                : <Button asChild variant="outline" size="sm"><Link href={pageHref(filterParams, currentPage - 1)}>Previous</Link></Button>}
              {currentPage >= totalPages
                ? <Button variant="outline" size="sm" disabled>Next</Button>
                : <Button asChild variant="outline" size="sm"><Link href={pageHref(filterParams, currentPage + 1)}>Next</Link></Button>}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
