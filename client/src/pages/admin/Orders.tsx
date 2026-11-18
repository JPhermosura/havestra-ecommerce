import { useState } from "react";
import axios from "axios";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const orderStatuses = [
  "Order Placed",
  "Payment Confirmed",
  "Preparing Order",
  "Packed",
  "Shipped",
  "Out for Delivery",
  "Delivered",
  "Cancelled",
];
const deliveryStatuses = [
  "Pending",
  "In Transit",
  "Out for Delivery",
  "Delivered",
];

type OrderEditor = {
  id: string;
  orderId: string;
  type: "status" | "tracking";
  status: string;
  deliveryStatus: string;
};

export default function AdminOrders() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [editor, setEditor] = useState<OrderEditor | null>(null);
  const [editorError, setEditorError] = useState("");
  const queryClient = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery(
    ["admin_orders", { search, status, page }],
    async () => {
      const params: Record<string, string | number> = { page, limit: 20 };
      if (search) params.search = search;
      if (status) params.status = status;
      const res = await axios.get("/api/admin/orders", { params });
      return res.data;
    },
    { keepPreviousData: true }
  );

  const updateMut = useMutation(
    async ({
      id,
      updates,
    }: {
      id: string;
      updates:
        | { status: string }
        | { trackingHistoryEntry: { status: string }; deliveryStatus: string };
    }) => axios.put(`/api/admin/orders/${id}`, updates),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(["admin_orders"]);
        toast.success("Order updated");
        setEditor(null);
        setEditorError("");
      },
      onError: error => {
        const message =
          axios.isAxiosError(error) &&
          typeof error.response?.data?.error === "string"
            ? error.response.data.error
            : "Could not update the order.";
        setEditorError(message);
        toast.error(message);
      },
    }
  );

  const orders = data?.orders || [];
  const total = data?.total || 0;

  function saveEditor(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor) return;
    const updates =
      editor.type === "status"
        ? { status: editor.status }
        : {
            trackingHistoryEntry: { status: editor.deliveryStatus },
            deliveryStatus: editor.deliveryStatus,
          };
    updateMut.mutate({ id: editor.id, updates });
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 py-6 sm:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-bold">Order Management</h1>
          <div className="grid w-full grid-cols-1 gap-2 sm:flex sm:w-auto sm:items-center">
            <Input
              className="w-full sm:w-64"
              placeholder="Search order id, buyer or phone"
              value={search}
              onChange={e => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
            <select
              value={status}
              onChange={e => {
                setStatus(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-lg border px-3 py-2 sm:w-auto"
            >
              <option value="">All</option>
              <option>Order Placed</option>
              <option>Payment Confirmed</option>
              <option>Preparing Order</option>
              <option>Packed</option>
              <option>Shipped</option>
              <option>Out for Delivery</option>
              <option>Delivered</option>
              <option>Cancelled</option>
            </select>
            <Button
              className="w-full sm:w-auto"
              onClick={() => {
                setSearch("");
                setStatus("");
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
              Loading orders...
            </div>
          ) : isError ? (
            <div role="alert" className="p-8 text-center">
              <p className="text-red-700">Orders could not be loaded.</p>
              <Button
                className="mt-4"
                variant="outline"
                onClick={() => void refetch()}
              >
                Try again
              </Button>
            </div>
          ) : orders.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              No orders found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full table-auto text-sm">
                <thead>
                  <tr className="text-left text-slate-500">
                    <th className="p-3">Order ID</th>
                    <th className="p-3">Buyer</th>
                    <th className="p-3">Phone</th>
                    <th className="p-3">Total</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o: any) => (
                    <tr key={o._id} className="border-t">
                      <td className="p-3">{o.orderId}</td>
                      <td className="p-3">{o.buyerName}</td>
                      <td className="p-3">{o.buyerPhone}</td>
                      <td className="p-3">{o.totalAmount}</td>
                      <td className="p-3">{o.status}</td>
                      <td className="p-3 space-x-2">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setEditor({
                              id: o._id,
                              orderId: o.orderId,
                              type: "status",
                              status: o.status,
                              deliveryStatus: o.deliveryStatus || "Pending",
                            });
                            setEditorError("");
                          }}
                        >
                          Update Status
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setEditor({
                              id: o._id,
                              orderId: o.orderId,
                              type: "tracking",
                              status: o.status,
                              deliveryStatus: o.deliveryStatus || "Pending",
                            });
                            setEditorError("");
                          }}
                        >
                          Add Tracking
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
              Showing {orders.length} of {total} orders
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
      {editor && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
          onMouseDown={event => {
            if (event.target === event.currentTarget && !updateMut.isLoading)
              setEditor(null);
          }}
        >
          <form
            role="dialog"
            aria-modal="true"
            aria-labelledby="order-editor-title"
            onSubmit={saveEditor}
            className="w-full max-w-md space-y-5 rounded-2xl bg-white p-6 shadow-xl"
          >
            <div>
              <h2 id="order-editor-title" className="text-xl font-semibold">
                {editor.type === "status"
                  ? "Update order status"
                  : "Add tracking update"}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Order {editor.orderId}
              </p>
            </div>
            {editor.type === "status" ? (
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Order status
                <select
                  value={editor.status}
                  onChange={event =>
                    setEditor({ ...editor, status: event.target.value })
                  }
                  className="h-10 rounded-lg border border-slate-300 px-3"
                >
                  {orderStatuses.map(value => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </label>
            ) : (
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Delivery status
                <select
                  value={editor.deliveryStatus}
                  onChange={event =>
                    setEditor({ ...editor, deliveryStatus: event.target.value })
                  }
                  className="h-10 rounded-lg border border-slate-300 px-3"
                >
                  {deliveryStatuses.map(value => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </label>
            )}
            {editorError && (
              <p role="alert" className="text-sm text-red-700">
                {editorError}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={updateMut.isLoading}
                onClick={() => setEditor(null)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={updateMut.isLoading}>
                {updateMut.isLoading ? "Saving..." : "Save update"}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
