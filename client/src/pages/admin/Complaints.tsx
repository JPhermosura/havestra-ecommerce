import { useState } from "react";
import axios from "axios";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export default function AdminComplaints() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery(["admin_complaints", { status, page }], async () => {
    const params: any = { page, limit: 20 };
    if (status) params.status = status;
    const res = await axios.get("/api/admin/complaints", { params });
    return res.data;
  }, { keepPreviousData: true });

  const resolveMut = useMutation(async ({ id, updates }: any) => axios.put(`/api/admin/complaints/${id}`, updates), {
    onSuccess: () => { queryClient.invalidateQueries(["admin_complaints"]); toast.success("Complaint updated"); }
  });
  const deleteMut = useMutation(async (id: string) => axios.delete(`/api/admin/complaints/${id}`), {
    onSuccess: () => { queryClient.invalidateQueries(["admin_complaints"]); toast.success("Complaint deleted"); }
  });

  const complaints = data?.complaints || [];
  const total = data?.total || 0;

  return (
    <div className="bg-slate-50 min-h-screen p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Complaints</h1>
        </div>

        <div className="bg-white rounded-2xl shadow p-4">
          <div className="flex items-center gap-2 mb-4">
            <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }} className="rounded-lg border px-3 py-2">
              <option value="">All</option>
              <option value="open">Open</option>
              <option value="resolved">Resolved</option>
            </select>
            <Button onClick={() => { setStatus(""); setPage(1); }}>Reset</Button>
          </div>
          {isLoading ? (
            <div className="p-8 text-center text-slate-500">Loading complaints...</div>
          ) : complaints.length === 0 ? (
            <div className="p-8 text-center text-slate-500">No complaints found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full table-auto text-sm">
                <thead>
                  <tr className="text-left text-slate-500">
                    <th className="p-3">Subject</th>
                    <th className="p-3">Order</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {complaints.map((c: any) => (
                    <tr key={c._id} className="border-t">
                      <td className="p-3">{c.subject}</td>
                      <td className="p-3">{c.orderId || "—"}</td>
                      <td className="p-3">{c.status}</td>
                      <td className="p-3 space-x-2">
                        {c.status !== "resolved" && (
                          <Button variant="outline" onClick={() => resolveMut.mutate({ id: c._id, updates: { status: "resolved" } })}>Resolve</Button>
                        )}
                        <Button variant="destructive" onClick={() => { if (confirm("Delete complaint?")) deleteMut.mutate(c._id); }}>Delete</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-slate-500">Showing {complaints.length} of {total} complaints</div>
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
