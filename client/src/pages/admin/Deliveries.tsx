import { useState } from "react";
import axios from "axios";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";

export default function AdminDeliveries() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery(["admin_deliveries", page], async () => {
    const res = await axios.get("/api/admin/deliveries", { params: { page, limit: 20 } });
    return res.data;
  }, { keepPreviousData: true });

  const orders = data?.orders || [];
  const total = data?.total || 0;

  return (
    <div className="bg-slate-50 min-h-screen p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Active Deliveries</h1>
        </div>

        <div className="bg-white rounded-2xl shadow p-4">
          {isLoading ? (
            <div className="p-8 text-center text-slate-500">Loading active deliveries...</div>
          ) : orders.length === 0 ? (
            <div className="p-8 text-center text-slate-500">No active deliveries right now.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full table-auto text-sm">
                <thead>
                  <tr className="text-left text-slate-500">
                    <th className="p-3">Order ID</th>
                    <th className="p-3">Buyer</th>
                    <th className="p-3">Delivery Status</th>
                    <th className="p-3">Last Updated</th>
                    <th className="p-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o: any) => (
                    <tr key={o._id} className="border-t">
                      <td className="p-3">{o.orderId}</td>
                      <td className="p-3">{o.buyerName}</td>
                      <td className="p-3">{o.deliveryStatus}</td>
                      <td className="p-3">{new Date(o.updatedAt).toLocaleString()}</td>
                      <td className="p-3">
                        <Button variant="outline" onClick={async () => {
                          const res = await axios.get(`/api/admin/deliveries/${o._id}/history`);
                          alert(JSON.stringify(res.data, null, 2));
                        }}>View History</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-slate-500">Showing {orders.length} of {total} active deliveries</div>
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
