import { useState } from "react";
import axios from "axios";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";

type AuditEntry = {
  id: string;
  timestamp: string;
  action: string;
  source: "identity_review" | "admin_activity";
  reviewerUserId?: string;
  targetUserId?: string;
  reasonCode?: string;
};

type AuditResponse = {
  entries: AuditEntry[];
  total: number;
  page: number;
  totalPages: number;
};

export default function AuditHistory() {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const { data, isLoading, isError, refetch } = useQuery<AuditResponse>(
    ["admin_audit", page, actionFilter],
    async () => {
      const response = await axios.get("/api/admin/audit", {
        params: {
          page,
          limit: 25,
          ...(actionFilter ? { action: actionFilter } : {}),
        },
      });
      return response.data;
    }
  );

  function applyFilter(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setActionFilter(action.trim());
  }

  return (
    <div className="space-y-5">
      <form
        onSubmit={applyFilter}
        className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4"
      >
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          Exact action
          <input
            value={action}
            onChange={event => setAction(event.target.value)}
            className="h-9 rounded-lg border border-slate-300 px-3 font-normal"
            placeholder="e.g. APPROVE"
          />
        </label>
        <Button type="submit">Filter</Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setAction("");
            setActionFilter("");
            setPage(1);
          }}
        >
          Clear
        </Button>
      </form>

      {isLoading ? (
        <div className="rounded-2xl bg-white p-8 text-center text-slate-500">
          Loading audit history...
        </div>
      ) : isError ? (
        <div
          role="alert"
          className="rounded-2xl border border-red-200 bg-white p-8 text-center"
        >
          <p className="text-red-700">Audit history could not be loaded.</p>
          <Button
            className="mt-4"
            variant="outline"
            onClick={() => void refetch()}
          >
            Try again
          </Button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="p-3">Time</th>
                <th className="p-3">Action</th>
                <th className="p-3">Source</th>
                <th className="p-3">Reviewer ID</th>
                <th className="p-3">Target ID</th>
                <th className="p-3">Reason code</th>
              </tr>
            </thead>
            <tbody>
              {data?.entries.map(entry => (
                <tr key={entry.id} className="border-t border-slate-100">
                  <td className="whitespace-nowrap p-3">
                    {new Date(entry.timestamp).toLocaleString()}
                  </td>
                  <td className="p-3 font-medium">{entry.action}</td>
                  <td className="p-3">
                    {entry.source === "identity_review"
                      ? "Identity review"
                      : "Admin activity"}
                  </td>
                  <td className="p-3 font-mono text-xs">
                    {entry.reviewerUserId || "—"}
                  </td>
                  <td className="p-3 font-mono text-xs">
                    {entry.targetUserId || "—"}
                  </td>
                  <td className="p-3">{entry.reasonCode || "—"}</td>
                </tr>
              ))}
              {data?.entries.length === 0 && (
                <tr>
                  <td className="p-8 text-center text-slate-500" colSpan={6}>
                    No audit events match this filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <div className="flex items-center justify-between border-t border-slate-100 p-3">
            <span className="text-sm text-slate-500">
              {data?.total ?? 0} events
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage(current => current - 1)}
              >
                Previous
              </Button>
              <span className="self-center text-sm text-slate-600">
                {page} / {Math.max(data?.totalPages ?? 1, 1)}
              </span>
              <Button
                variant="outline"
                disabled={page >= (data?.totalPages ?? 1)}
                onClick={() => setPage(current => current + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
