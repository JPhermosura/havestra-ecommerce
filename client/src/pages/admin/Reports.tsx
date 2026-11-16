import { useState } from "react";
import axios from "axios";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";

type SellerReport = { _id: string; sales: number; orders: number };
type MonthlyReport = {
  _id: { year: number; month: number };
  total: number;
  count: number;
};
type ReportsResponse = {
  summary: {
    totalSales: number;
    totalOrders: number;
    monthly: MonthlyReport[];
  };
  bySeller: { sellers: SellerReport[] };
};

function dateString(date: Date) {
  return date.toISOString().slice(0, 10);
}

function csvCell(value: string | number) {
  let safeValue = String(value);
  if (/^[=+\-@\t\r]/.test(safeValue)) safeValue = `'${safeValue}`;
  return `"${safeValue.replace(/"/g, '""')}"`;
}

export default function AdminReports() {
  const today = dateString(new Date());
  const monthAgo = new Date();
  monthAgo.setUTCDate(monthAgo.getUTCDate() - 29);
  const [startDate, setStartDate] = useState(dateString(monthAgo));
  const [endDate, setEndDate] = useState(today);
  const [appliedRange, setAppliedRange] = useState({
    startDate: dateString(monthAgo),
    endDate: today,
  });
  const [rangeError, setRangeError] = useState("");
  const { data, isLoading, isError, refetch } = useQuery<ReportsResponse>(
    ["admin_reports", appliedRange],
    async () => {
      const params = appliedRange;
      const [summaryRes, bySellerRes] = await Promise.all([
        axios.get("/api/admin/reports/summary", { params }),
        axios.get("/api/admin/reports/by-seller", { params }),
      ]);
      return { summary: summaryRes.data, bySeller: bySellerRes.data };
    }
  );

  function applyRange(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (startDate > endDate) {
      setRangeError("Start date must be on or before end date.");
      return;
    }
    setRangeError("");
    setAppliedRange({ startDate, endDate });
  }

  function exportCsv() {
    if (!data) return;
    const rows: Array<Array<string | number>> = [
      ["Report", "Sales", "Orders"],
      ["Summary", data.summary.totalSales, data.summary.totalOrders],
      ["Top sellers", "", ""],
      ["Seller ID", "Sales", "Orders"],
      ...data.bySeller.sellers.map(seller => [
        seller._id,
        seller.sales,
        seller.orders,
      ]),
      ["Monthly sales", "", ""],
      ["Month", "Sales", "Orders"],
      ...data.summary.monthly.map(month => [
        `${month._id.year}-${String(month._id.month).padStart(2, "0")}`,
        month.total,
        month.count,
      ]),
    ];
    const csv = rows.map(row => row.map(csvCell).join(",")).join("\r\n");
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" })
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `sales-report-${appliedRange.startDate}-to-${appliedRange.endDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={applyRange}
        className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4"
      >
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          From
          <input
            type="date"
            value={startDate}
            max={endDate}
            onChange={event => setStartDate(event.target.value)}
            className="h-9 rounded-lg border border-slate-300 px-3"
            required
          />
        </label>
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          To
          <input
            type="date"
            value={endDate}
            min={startDate}
            onChange={event => setEndDate(event.target.value)}
            className="h-9 rounded-lg border border-slate-300 px-3"
            required
          />
        </label>
        <Button type="submit">Apply dates</Button>
        <Button
          type="button"
          variant="outline"
          disabled={!data}
          onClick={exportCsv}
        >
          Export CSV
        </Button>
        {rangeError && (
          <p role="alert" className="w-full text-sm text-red-700">
            {rangeError}
          </p>
        )}
      </form>

      {isLoading ? (
        <div className="rounded-2xl bg-white p-8 text-slate-500">
          Loading reports...
        </div>
      ) : isError ? (
        <div
          role="alert"
          className="rounded-2xl border border-red-200 bg-white p-8"
        >
          <p className="text-red-700">
            Reports could not be loaded for these dates.
          </p>
          <Button
            className="mt-4"
            variant="outline"
            onClick={() => void refetch()}
          >
            Try again
          </Button>
        </div>
      ) : data ? (
        <>
          <p className="text-sm text-slate-500">
            Delivered order sales from {appliedRange.startDate} through{" "}
            {appliedRange.endDate}.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <h2 className="text-sm font-medium text-slate-500">
                Total sales
              </h2>
              <p className="mt-2 text-2xl font-bold text-slate-900">
                {new Intl.NumberFormat(undefined, {
                  style: "currency",
                  currency: "PHP",
                }).format(data.summary.totalSales)}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <h2 className="text-sm font-medium text-slate-500">
                Delivered orders
              </h2>
              <p className="mt-2 text-2xl font-bold text-slate-900">
                {data.summary.totalOrders}
              </p>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <section className="overflow-x-auto rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="mb-4 text-lg font-semibold">Top sellers</h2>
              <table className="w-full text-left text-sm">
                <thead className="text-slate-500">
                  <tr>
                    <th className="pb-2">Seller ID</th>
                    <th className="pb-2">Sales</th>
                    <th className="pb-2">Orders</th>
                  </tr>
                </thead>
                <tbody>
                  {data.bySeller.sellers.map(seller => (
                    <tr key={seller._id} className="border-t border-slate-100">
                      <td className="py-3 font-mono text-xs">{seller._id}</td>
                      <td className="py-3">
                        {new Intl.NumberFormat(undefined, {
                          style: "currency",
                          currency: "PHP",
                        }).format(seller.sales)}
                      </td>
                      <td className="py-3">{seller.orders}</td>
                    </tr>
                  ))}
                  {data.bySeller.sellers.length === 0 && (
                    <tr>
                      <td className="py-4 text-slate-500" colSpan={3}>
                        No sales in this period.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </section>
            <section className="overflow-x-auto rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="mb-4 text-lg font-semibold">Monthly sales</h2>
              <table className="w-full text-left text-sm">
                <thead className="text-slate-500">
                  <tr>
                    <th className="pb-2">Month</th>
                    <th className="pb-2">Sales</th>
                    <th className="pb-2">Orders</th>
                  </tr>
                </thead>
                <tbody>
                  {data.summary.monthly.map(month => (
                    <tr
                      key={`${month._id.year}-${month._id.month}`}
                      className="border-t border-slate-100"
                    >
                      <td className="py-3">
                        {new Date(
                          Date.UTC(month._id.year, month._id.month - 1)
                        ).toLocaleString(undefined, {
                          month: "long",
                          year: "numeric",
                          timeZone: "UTC",
                        })}
                      </td>
                      <td className="py-3">
                        {new Intl.NumberFormat(undefined, {
                          style: "currency",
                          currency: "PHP",
                        }).format(month.total)}
                      </td>
                      <td className="py-3">{month.count}</td>
                    </tr>
                  ))}
                  {data.summary.monthly.length === 0 && (
                    <tr>
                      <td className="py-4 text-slate-500" colSpan={3}>
                        No sales in this period.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </section>
          </div>
        </>
      ) : null}
    </div>
  );
}
