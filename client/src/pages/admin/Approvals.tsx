import { useState } from "react";
import axios from "axios";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import AdminVerificationPanel from "./AdminVerificationPanel";

export default function AdminApprovals() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery(["admin_approvals", { search, page }], async () => {
    const params: any = { page, limit: 20 };
    if (search) params.search = search;
    const res = await axios.get("/api/admin/approvals/sellers", { params });
    return res.data;
  }, { keepPreviousData: true });

  const approveMut = useMutation(async (id: string) => axios.put(`/api/admin/approvals/sellers/${id}/approve`), {
    onSuccess: () => { queryClient.invalidateQueries(["admin_approvals"]); toast.success("Seller approved"); },
    onError: (error: any) => toast.error(error.response?.data?.error || "Seller could not be approved"),
  });
  const rejectMut = useMutation(async (id: string) => axios.put(`/api/admin/approvals/sellers/${id}/reject`), {
    onSuccess: () => { queryClient.invalidateQueries(["admin_approvals"]); toast.success("Seller rejected"); }
  });

  const sellers = data?.users || [];
  const total = data?.total || 0;

  return (
    <div className="bg-slate-50 min-h-screen p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">ID & Seller Approvals</h1>
          <div className="flex items-center gap-2">
            <Input placeholder="Search name, phone or farm" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
            <Button onClick={() => { setSearch(""); setPage(1); }}>Reset</Button>
          </div>
        </div>

        <AdminVerificationPanel />

        <div className="bg-white rounded-2xl shadow p-4">
          {isLoading ? (
            <div className="p-8 text-center text-slate-500">Loading pending sellers...</div>
          ) : sellers.length === 0 ? (
            <div className="p-8 text-center text-slate-500">No pending seller applications found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full table-auto text-sm">
                <thead>
                  <tr className="text-left text-slate-500">
                    <th className="p-3">Name</th>
                    <th className="p-3">Phone</th>
                    <th className="p-3">Farm</th>
                    <th className="p-3">ID</th>
                    <th className="p-3">Applied</th>
                    <th className="p-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sellers.map((s: any) => (
                    <tr key={s._id} className="border-t">
                      <td className="p-3">{s.name}</td>
                      <td className="p-3">{s.phone}</td>
                      <td className="p-3">{s.farmName || "—"}</td>
                      <td className="p-3">{s.isIdVerified ? "Verified" : "Pending ID review"}</td>
                      <td className="p-3">{new Date(s.createdAt).toLocaleString()}</td>
                      <td className="p-3 space-x-2">
                        <Button variant="outline" disabled={!s.isIdVerified || approveMut.isLoading} onClick={() => approveMut.mutate(s._id)}>Approve</Button>
                        <Button variant="destructive" onClick={() => { if (confirm("Reject this seller application?")) rejectMut.mutate(s._id); }}>Reject</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-slate-500">Showing {sellers.length} of {total} pending</div>
            <div className="space-x-2">
              <Button disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>Prev</Button>
              <Button disabled={(page * 20) >= total} onClick={() => setPage(p => p + 1)}>Next</Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
