import { useState } from "react";
import axios from "axios";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export default function AdminUsers() {
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<"" | "buyer" | "seller">("");
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();

  const { data, isLoading, isFetching } = useQuery([
    "admin_users",
    { search, role, page },
  ],
  async () => {
    const params: any = { page, limit: 20 };
    if (search) params.search = search;
    if (role) params.role = role;
    const res = await axios.get("/api/admin/users", { params });
    return res.data;
  }, { keepPreviousData: true });

  const suspendMut = useMutation(async (id: string) => axios.put(`/api/admin/users/${id}/suspend`), {
    onSuccess: () => { queryClient.invalidateQueries(["admin_users"]); toast.success("User suspended"); }
  });
  const reactivateMut = useMutation(async (id: string) => axios.put(`/api/admin/users/${id}/reactivate`), {
    onSuccess: () => { queryClient.invalidateQueries(["admin_users"]); toast.success("User reactivated"); }
  });
  const deleteMut = useMutation(async (id: string) => axios.delete(`/api/admin/users/${id}`), {
    onSuccess: () => { queryClient.invalidateQueries(["admin_users"]); toast.success("User deleted"); }
  });

  const users = data?.users || [];
  const total = data?.total || 0;

  return (
    <div className="bg-slate-50 min-h-screen p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">User Management</h1>
          <div className="flex items-center gap-2">
            <Input placeholder="Search name, phone or email" value={search} onChange={e => setSearch(e.target.value)} />
            <select value={role} onChange={e => { setRole(e.target.value as any); setPage(1); }} className="rounded-lg border px-3 py-2">
              <option value="">All</option>
              <option value="buyer">Buyer</option>
              <option value="seller">Seller</option>
            </select>
            <Button onClick={() => { setSearch(""); setRole(""); setPage(1); }}>Reset</Button>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow p-4">
          {isLoading ? (
            <div className="p-8 text-center text-slate-500">Loading users...</div>
          ) : users.length === 0 ? (
            <div className="p-8 text-center text-slate-500">No users found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full table-auto text-sm">
                <thead>
                  <tr className="text-left text-slate-500">
                    <th className="p-3">Name</th>
                    <th className="p-3">Phone</th>
                    <th className="p-3">Role</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u: any) => (
                    <tr key={u._id} className="border-t">
                      <td className="p-3">{u.name}</td>
                      <td className="p-3">{u.phone}</td>
                      <td className="p-3">{u.role}</td>
                      <td className="p-3">{u.isSuspended ? "Suspended" : "Active"}</td>
                      <td className="p-3 space-x-2">
                        {!u.isSuspended ? (
                          <Button variant="outline" onClick={() => suspendMut.mutate(u._id)}>Suspend</Button>
                        ) : (
                          <Button variant="outline" onClick={() => reactivateMut.mutate(u._id)}>Reactivate</Button>
                        )}
                        <Button variant="destructive" onClick={() => { if (confirm("Delete this user?")) deleteMut.mutate(u._id); }}>Delete</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-slate-500">Showing {users.length} of {total} users</div>
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
