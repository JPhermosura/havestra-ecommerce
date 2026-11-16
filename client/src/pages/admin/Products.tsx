import { useState } from "react";
import axios from "axios";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export default function AdminProducts() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [approvalStatus, setApprovalStatus] = useState("all");
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery(
    ["admin_products", { search, page, approvalStatus }],
    async () => {
      const params: Record<string, string | number> = { page, limit: 20 };
      if (search) params.search = search;
      if (approvalStatus !== "all") params.approvalStatus = approvalStatus;
      const res = await axios.get("/api/admin/products", { params });
      return res.data;
    },
    { keepPreviousData: true }
  );

  const updateMut = useMutation(
    async ({ id, updates }: { id: string; updates: Record<string, unknown> }) =>
      axios.put(`/api/admin/products/${id}`, updates),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(["admin_products"]);
        toast.success("Product updated");
      },
      onError: (error: any) =>
        toast.error(
          error.response?.data?.error || "Product could not be updated"
        ),
    }
  );
  const deleteMut = useMutation(
    async (id: string) => axios.delete(`/api/admin/products/${id}`),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(["admin_products"]);
        toast.success("Product deleted");
      },
      onError: (error: any) =>
        toast.error(
          error.response?.data?.error || "Product could not be deleted"
        ),
    }
  );
  const moderationMut = useMutation(
    async ({
      id,
      decision,
      reason,
    }: {
      id: string;
      decision: "approve" | "reject";
      reason?: string;
    }) =>
      decision === "approve"
        ? axios.put(`/api/admin/products/${id}/approve`)
        : axios.put(`/api/admin/products/${id}/reject`, { reason }),
    {
      onSuccess: (_data, variables) => {
        queryClient.invalidateQueries(["admin_products"]);
        toast.success(
          variables.decision === "approve"
            ? "Listing approved"
            : "Listing rejected"
        );
      },
      onError: (error: any) =>
        toast.error(
          error.response?.data?.error || "Moderation decision failed"
        ),
    }
  );

  const products = data?.products || [];
  const total = data?.total || 0;

  return (
    <div className="bg-slate-50 min-h-screen p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-bold">Product Management</h1>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              placeholder="Search title or description"
              value={search}
              onChange={event => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
            <select
              aria-label="Filter by listing approval"
              value={approvalStatus}
              onChange={event => {
                setApprovalStatus(event.target.value);
                setPage(1);
              }}
              className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <option value="all">All listings</option>
              <option value="pending">Pending review</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
            <Button
              variant="outline"
              onClick={() => {
                setSearch("");
                setApprovalStatus("all");
                setPage(1);
              }}
            >
              Reset
            </Button>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow p-4">
          {isLoading ? (
            <div className="p-8 text-center text-slate-500">
              Loading products...
            </div>
          ) : isError ? (
            <div role="alert" className="p-8 text-center text-red-700">
              Products could not be loaded.
            </div>
          ) : products.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              No products found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full table-auto text-sm">
                <thead>
                  <tr className="text-left text-slate-500">
                    <th className="p-3">Title</th>
                    <th className="p-3">Seller</th>
                    <th className="p-3">Price</th>
                    <th className="p-3">Stock</th>
                    <th className="p-3">Review status</th>
                    <th className="p-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p: any) => (
                    <tr key={p._id} className="border-t">
                      <td className="p-3">{p.title}</td>
                      <td className="p-3">
                        {p.sellerId?.name || p.sellerName || "—"}
                      </td>
                      <td className="p-3">{p.price}</td>
                      <td className="p-3">
                        <span>{p.stock ?? "—"}</span>
                        {p.stock > 0 && p.stock <= 5 && (
                          <span className="ml-2 rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800">
                            Low stock
                          </span>
                        )}
                      </td>
                      <td className="p-3">
                        <span className="capitalize">
                          {p.approvalStatus || "approved"}
                        </span>
                        {p.moderationReason && (
                          <p className="mt-1 max-w-xs text-xs text-red-700">
                            {p.moderationReason}
                          </p>
                        )}
                      </td>
                      <td className="p-3 space-x-2">
                        {p.approvalStatus === "pending" && (
                          <>
                            <Button
                              variant="outline"
                              disabled={moderationMut.isLoading}
                              onClick={() =>
                                moderationMut.mutate({
                                  id: p._id,
                                  decision: "approve",
                                })
                              }
                            >
                              Approve
                            </Button>
                            <Button
                              variant="destructive"
                              disabled={moderationMut.isLoading}
                              onClick={() => {
                                const reason = window.prompt(
                                  "Why is this listing being rejected?"
                                );
                                if (reason?.trim()) {
                                  moderationMut.mutate({
                                    id: p._id,
                                    decision: "reject",
                                    reason: reason.trim(),
                                  });
                                } else if (reason !== null) {
                                  toast.error(
                                    "A rejection reason is required."
                                  );
                                }
                              }}
                            >
                              Reject
                            </Button>
                          </>
                        )}
                        <Button
                          variant="outline"
                          onClick={async () => {
                            const newTitle = prompt("New title", p.title);
                            const newPriceStr = prompt(
                              "New price",
                              String(p.price ?? "")
                            );
                            if (newTitle == null || newPriceStr == null) return;
                            const newPrice = Number(newPriceStr);
                            updateMut.mutate({
                              id: p._id,
                              updates: { title: newTitle, price: newPrice },
                            });
                          }}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={() => {
                            if (confirm("Delete this product?"))
                              deleteMut.mutate(p._id);
                          }}
                        >
                          Delete
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-slate-500">
              Showing {products.length} of {total} products
            </div>
            <div className="space-x-2">
              <Button
                disabled={page <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
              >
                Prev
              </Button>
              <Button
                disabled={page * 20 >= total}
                onClick={() => setPage(p => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
