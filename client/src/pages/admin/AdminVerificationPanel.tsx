import { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle,
  Clock,
  FileText,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  ShoppingBag,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

const rejectionReasons = [
  { value: "blurry_image", label: "Blurry image" },
  { value: "name_mismatch", label: "Name mismatch" },
  { value: "expired_document", label: "Expired document" },
  { value: "unsupported_document", label: "Unsupported document" },
  { value: "other", label: "Other issue" },
] as const;
type ReasonCode = (typeof rejectionReasons)[number]["value"];
type QueueItem = {
  _id: string;
  name: string;
  phone: string;
  role: "buyer" | "seller";
  idType?: string;
  idVerificationStatus: string;
  idNameConsistent?: boolean | null;
  idSubmittedAt?: string;
  createdAt: string;
  hasPriorRejection: boolean;
};
type ReviewHistoryItem = {
  _id: string;
  status: "verified" | "rejected";
  reasonCode?: ReasonCode;
  reasonNote?: string;
  reviewerId: string;
  reviewedAt: string;
};
type VerificationDetail = {
  id: string;
  status: string;
  idType?: string;
  idNameConsistent?: boolean | null;
  submittedAt?: string;
  documents: { id: "front" | "back"; side: string; available: boolean }[];
  reviews: ReviewHistoryItem[];
};
type QueueResponse = { items: QueueItem[]; total: number; totalPages: number };

const reasonLabel = (reasonCode?: ReasonCode) =>
  rejectionReasons.find(reason => reason.value === reasonCode)?.label || "—";

export default function AdminVerificationPanel() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState("");
  const [detail, setDetail] = useState<VerificationDetail | null>(null);
  const [documentUrls, setDocumentUrls] = useState<
    Partial<Record<"front" | "back", string>>
  >({});
  const [reasonCode, setReasonCode] = useState<ReasonCode | "">("");
  const [reasonNote, setReasonNote] = useState("");
  const [isQueueLoading, setIsQueueLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isDocumentLoading, setIsDocumentLoading] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);
  const [error, setError] = useState("");
  const [pageCount, setPageCount] = useState(1);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [roleFilter, setRoleFilter] = useState<"all" | "buyer" | "seller">(
    "all"
  );
  const [historyFilter, setHistoryFilter] = useState<
    "all" | "first" | "resubmitted"
  >("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileQueueOpen, setMobileQueueOpen] = useState(true);
  const [approveConfirmOpen, setApproveConfirmOpen] = useState(false);
  const reasonSelectRef = useRef<HTMLSelectElement | null>(null);
  const documentUrlsRef = useRef(documentUrls);
  const { user, logout } = useAuth();
  const sessionIsAdminRef = useRef(Boolean(user && user.role === "admin"));
  sessionIsAdminRef.current = Boolean(user && user.role === "admin");

  const selected = useMemo(
    () => items.find(item => item._id === selectedId),
    [items, selectedId]
  );
  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase();
    if (!query) return items;
    return items.filter(item =>
      [item.name, item.phone, item.role, item.idType]
        .filter(Boolean)
        .some(value => String(value).toLocaleLowerCase().includes(query))
    );
  }, [items, searchQuery]);
  const buyerCount = items.filter(item => item.role === "buyer").length;
  const sellerCount = items.filter(item => item.role === "seller").length;

  const formatDate = (value?: string) => {
    if (!value) return "Date unavailable";
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? "Date unavailable"
      : new Intl.DateTimeFormat(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
        }).format(date);
  };

  useEffect(() => {
    documentUrlsRef.current = documentUrls;
  }, [documentUrls]);

  useEffect(() => {
    const clearPrivateState = () => {
      Object.values(documentUrlsRef.current).forEach(url => {
        if (url) URL.revokeObjectURL(url);
      });
      documentUrlsRef.current = {};
      setDocumentUrls({});
      setDetail(null);
      setItems([]);
      setSelectedId("");
      setApproveConfirmOpen(false);
    };

    if (!user || user.role !== "admin") clearPrivateState();
    const handlePageHide = () => clearPrivateState();
    window.addEventListener("pagehide", handlePageHide);
    return () => window.removeEventListener("pagehide", handlePageHide);
  }, [user]);

  useEffect(() => {
    let active = true;
    setIsQueueLoading(true);
    setError("");
    axios
      .get<QueueResponse>("/api/admin/verifications/pending", {
        params: {
          page,
          limit: 20,
          ...(roleFilter !== "all" ? { role: roleFilter } : {}),
          submissionHistory: historyFilter,
        },
      })
      .then(({ data }) => {
        if (!active || !sessionIsAdminRef.current) return;
        setItems(data.items);
        setTotal(data.total);
        setPageCount(Math.max(1, data.totalPages));
        setSelectedId(current =>
          data.items.some(item => item._id === current)
            ? current
            : data.items[0]?._id || ""
        );
      })
      .catch(requestError => {
        if (active) {
          if (
            axios.isAxiosError(requestError) &&
            requestError.response?.status === 401
          )
            logout();
          setError(
            axios.isAxiosError(requestError)
              ? requestError.response?.data?.error ||
                  "Could not load pending verifications."
              : "Could not load pending verifications."
          );
        }
      })
      .finally(() => {
        if (active) setIsQueueLoading(false);
      });
    return () => {
      active = false;
    };
  }, [page, refreshVersion, roleFilter, historyFilter]);

  useEffect(() => {
    let active = true;
    let createdUrls: string[] = [];
    setDetail(null);
    setDocumentUrls({});
    setReasonCode("");
    setReasonNote("");
    if (!selectedId)
      return () => {
        active = false;
      };

    setIsDetailLoading(true);
    setIsDocumentLoading(true);
    setError("");
    axios
      .get<{ verification: VerificationDetail }>(
        `/api/admin/verifications/${selectedId}`
      )
      .then(async ({ data }) => {
        if (!active || !sessionIsAdminRef.current) return;
        setDetail(data.verification);
        const available = data.verification.documents.filter(
          document => document.available
        );
        const results = await Promise.all(
          available.map(async document => {
            const response = await axios.get(
              `/api/admin/verifications/${selectedId}/document/${document.id}`,
              { responseType: "blob" }
            );
            const url = URL.createObjectURL(response.data);
            createdUrls.push(url);
            return [document.id, url] as const;
          })
        );
        if (active && sessionIsAdminRef.current)
          setDocumentUrls(Object.fromEntries(results));
        else createdUrls.forEach(URL.revokeObjectURL);
      })
      .catch(requestError => {
        createdUrls.forEach(URL.revokeObjectURL);
        createdUrls = [];
        if (active) {
          if (
            axios.isAxiosError(requestError) &&
            requestError.response?.status === 401
          )
            logout();
          setError(
            axios.isAxiosError(requestError)
              ? requestError.response?.data?.error ||
                  "Could not load verification details or ID photos."
              : "Could not load verification details or ID photos."
          );
        }
      })
      .finally(() => {
        if (active) {
          setIsDetailLoading(false);
          setIsDocumentLoading(false);
        }
      });
    return () => {
      active = false;
      createdUrls.forEach(URL.revokeObjectURL);
    };
  }, [selectedId]);

  async function submitReview(decision: "approve" | "reject") {
    if (!selectedId) return;
    if (decision === "reject" && !reasonCode) {
      setError("Select a reason before rejecting this ID.");
      return;
    }
    if (
      detail?.documents.some(
        document => !document.available || !documentUrls[document.id]
      )
    ) {
      setError("Both ID photos must load successfully before you can decide.");
      return;
    }

    setIsReviewing(true);
    setError("");
    try {
      await axios.put(`/api/admin/verifications/${selectedId}/review`, {
        decision,
        ...(decision === "reject"
          ? { reasonCode, reasonNote: reasonNote.trim() }
          : {}),
      });
      setItems(current => current.filter(item => item._id !== selectedId));
      setTotal(current => Math.max(0, current - 1));
      setSelectedId("");
      setMobileQueueOpen(true);
      setApproveConfirmOpen(false);
      setPage(current =>
        current > 1 && items.length === 1 ? current - 1 : current
      );
      setRefreshVersion(current => current + 1);
    } catch (requestError) {
      if (
        axios.isAxiosError(requestError) &&
        requestError.response?.status === 401
      ) {
        logout();
      }
      setError(
        axios.isAxiosError(requestError)
          ? requestError.response?.data?.error ||
              "Could not save this review decision."
          : "Could not save this review decision."
      );
    } finally {
      setIsReviewing(false);
    }
  }

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
      )
        return;

      if (event.key.toLowerCase() === "a" && selectedId && !isReviewing) {
        event.preventDefault();
        setApproveConfirmOpen(true);
      } else if (
        event.key.toLowerCase() === "r" &&
        selectedId &&
        !isReviewing
      ) {
        event.preventDefault();
        reasonSelectRef.current?.focus();
      } else if (event.key === "Escape") {
        setApproveConfirmOpen(false);
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [selectedId, isReviewing]);

  return (
    <section
      aria-labelledby="verification-review-heading"
      className="space-y-6 rounded-3xl bg-slate-50 p-3 sm:p-5 lg:p-6"
    >
      <header className="flex flex-col gap-5 rounded-3xl bg-slate-950 p-5 text-white shadow-sm sm:p-7 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-emerald-100">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            Restricted admin workspace
          </div>
          <h2
            id="verification-review-heading"
            className="text-2xl font-bold tracking-tight sm:text-3xl"
          >
            Identity review
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-300 sm:text-base">
            Review both sides of each government ID before recording a decision.
            Applicant documents stay private.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <p className="hidden rounded-xl border border-white/15 px-3 py-2 text-xs text-slate-300 xl:block">
            <kbd className="rounded bg-white/10 px-1.5 py-1 font-semibold text-white">
              A
            </kbd>
            <span className="mx-1.5">Approve</span>
            <kbd className="rounded bg-white/10 px-1.5 py-1 font-semibold text-white">
              R
            </kbd>
            <span className="ml-1.5">Reject</span>
          </p>
          <Button
            variant="outline"
            disabled={isQueueLoading}
            onClick={() => setRefreshVersion(current => current + 1)}
            className="border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white"
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${isQueueLoading ? "animate-spin" : ""}`}
              aria-hidden="true"
            />
            Refresh queue
          </Button>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Pending reviews",
            value: total,
            detail: "Applications match current filters",
            icon: FileText,
            tone: "text-emerald-700 bg-emerald-50",
          },
          {
            label: "Buyers on this page",
            value: buyerCount,
            detail: "Current page",
            icon: User,
            tone: "text-sky-700 bg-sky-50",
          },
          {
            label: "Sellers on this page",
            value: sellerCount,
            detail: "Current page",
            icon: ShoppingBag,
            tone: "text-amber-700 bg-amber-50",
          },
          {
            label: "Resubmitted",
            value: items.filter(item => item.hasPriorRejection).length,
            detail: "Current page",
            icon: RefreshCw,
            tone: "text-violet-700 bg-violet-50",
          },
        ].map(metric => {
          const Icon = metric.icon;
          return (
            <article
              key={metric.label}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-600">
                    {metric.label}
                  </p>
                  <p className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
                    {isQueueLoading && metric.label === "Pending reviews"
                      ? "—"
                      : metric.value}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">{metric.detail}</p>
                </div>
                <span
                  className={`flex h-10 w-10 items-center justify-center rounded-xl ${metric.tone}`}
                >
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
              </div>
            </article>
          );
        })}
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900"
        >
          {error}
        </p>
      )}

      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(18rem,0.82fr)_minmax(0,1.8fr)]">
        <aside
          aria-label="Pending submissions"
          className={`${mobileQueueOpen ? "block" : "hidden"} min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm md:block`}
        >
          <div className="space-y-4 border-b border-slate-200 p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-950">
                  Review queue <span className="text-slate-400">({total})</span>
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Oldest submissions are shown first
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                <span
                  className="h-1.5 w-1.5 rounded-full bg-emerald-600"
                  aria-hidden="true"
                />
                Pending
              </span>
            </div>
            <label className="relative block">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <input
                type="search"
                value={searchQuery}
                onChange={event => setSearchQuery(event.target.value)}
                placeholder="Search this page"
                aria-label="Search applicants on this page"
                className="min-h-11 w-full rounded-xl border border-slate-300 bg-slate-50 pl-9 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-100"
              />
            </label>
            <fieldset className="mt-3 space-y-3">
              <legend className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Filters
              </legend>
              <div className="flex flex-wrap gap-2" aria-label="Filter by role">
                {(["all", "buyer", "seller"] as const).map(role => (
                  <button
                    key={role}
                    type="button"
                    aria-pressed={roleFilter === role}
                    onClick={() => {
                      setRoleFilter(role);
                      setPage(1);
                    }}
                    className={`rounded-full border px-3 py-1.5 text-sm capitalize focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 ${
                      roleFilter === role
                        ? "border-emerald-700 bg-emerald-700 text-white"
                        : "border-slate-300 text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {role === "all" ? "All roles" : role}
                  </button>
                ))}
              </div>
              <div
                className="flex flex-wrap gap-2"
                aria-label="Filter by submission history"
              >
                {(
                  [
                    ["all", "All submissions"],
                    ["first", "First submission"],
                    ["resubmitted", "Resubmitted"],
                  ] as const
                ).map(([filter, label]) => (
                  <button
                    key={filter}
                    type="button"
                    aria-pressed={historyFilter === filter}
                    onClick={() => {
                      setHistoryFilter(filter);
                      setPage(1);
                    }}
                    className={`rounded-full border px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 ${
                      historyFilter === filter
                        ? "border-emerald-700 bg-emerald-700 text-white"
                        : "border-slate-300 text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </fieldset>
          </div>
          {isQueueLoading ? (
            <div
              role="status"
              className="flex items-center gap-2 p-5 text-sm text-slate-600"
            >
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Loading pending submissions…
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="p-6 text-center">
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                <Search className="h-5 w-5" aria-hidden="true" />
              </div>
              <p className="mt-3 text-sm font-semibold text-slate-800">
                {items.length
                  ? "No applicants match your search"
                  : "No pending ID reviews"}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {items.length
                  ? "Try another name, phone number, or ID type."
                  : "You’re all caught up for these filters."}
              </p>
            </div>
          ) : (
            <ul className="max-h-[min(48rem,65vh)] divide-y divide-slate-100 overflow-y-auto">
              {filteredItems.map(item => (
                <li key={item._id}>
                  <button
                    type="button"
                    aria-current={selectedId === item._id ? "true" : undefined}
                    onClick={() => {
                      setSelectedId(item._id);
                      setMobileQueueOpen(false);
                    }}
                    className={`w-full p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-700 ${
                      selectedId === item._id
                        ? "bg-emerald-50"
                        : "hover:bg-slate-50"
                    }`}
                  >
                    <span className="flex items-start justify-between gap-3">
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-slate-950">
                          {item.name}
                        </span>
                        <span className="mt-1 block truncate text-sm text-slate-600">
                          {item.phone}
                        </span>
                      </span>
                      <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium capitalize text-slate-700">
                        {item.role}
                      </span>
                    </span>
                    <span className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span>{item.idType || "ID type not specified"}</span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {formatDate(item.idSubmittedAt || item.createdAt)}
                      </span>
                    </span>
                    <span
                      className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                        item.hasPriorRejection
                          ? "bg-amber-50 text-amber-800"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {item.hasPriorRejection && (
                        <RefreshCw className="h-3 w-3" aria-hidden="true" />
                      )}
                      {item.hasPriorRejection
                        ? "Resubmitted"
                        : "First submission"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 p-3 text-sm">
            <span className="text-slate-600">
              Page {page} of {pageCount}
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={page <= 1 || isQueueLoading}
                onClick={() => setPage(value => value - 1)}
              >
                Previous
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={page >= pageCount || isQueueLoading}
                onClick={() => setPage(value => value + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </aside>

        <div
          className={`${mobileQueueOpen ? "hidden" : "block"} min-w-0 space-y-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 md:block`}
        >
          <button
            type="button"
            onClick={() => setMobileQueueOpen(true)}
            className="inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm font-medium text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 md:hidden"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to queue
          </button>
          {!selectedId ? (
            <div className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-slate-600">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-800">
                <ShieldCheck className="h-7 w-7" aria-hidden="true" />
              </span>
              <p className="mt-4 font-semibold text-slate-900">
                Ready for review
              </p>
              <p className="mt-1 max-w-sm text-sm text-slate-600">
                Choose an applicant from the queue to view their documents and
                review history.
              </p>
            </div>
          ) : isDetailLoading || !selected || !detail ? (
            <div
              role="status"
              className="flex min-h-72 items-center justify-center gap-3 text-slate-600"
            >
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />{" "}
              Loading verification…
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-800">
                    {selected.role === "seller" ? (
                      <ShoppingBag className="h-6 w-6" aria-hidden="true" />
                    ) : (
                      <User className="h-6 w-6" aria-hidden="true" />
                    )}
                  </span>
                  <div className="min-w-0">
                    <h3 className="truncate text-xl font-bold tracking-tight text-slate-950">
                      {selected.name}
                    </h3>
                    <p className="mt-1 break-words text-sm text-slate-600">
                      {selected.phone}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium capitalize text-slate-700">
                        {selected.role}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                        {detail.idType || "ID type not specified"}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="shrink-0 sm:text-right">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Submitted
                  </p>
                  <p className="mt-1 text-sm font-medium text-slate-800">
                    {formatDate(detail.submittedAt || selected.createdAt)}
                  </p>
                </div>
              </div>

              <section
                aria-labelledby="name-check-heading"
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
              >
                <h4
                  id="name-check-heading"
                  className="text-xs font-semibold uppercase tracking-wide text-slate-500"
                >
                  Automated name comparison
                </h4>
                {detail.idNameConsistent === null ||
                detail.idNameConsistent === undefined ? (
                  <p className="mt-2 flex items-start gap-2 text-sm text-amber-900">
                    <AlertTriangle
                      className="mt-0.5 h-4 w-4 shrink-0"
                      aria-hidden="true"
                    />
                    Unavailable. This check is only a hint and must not be
                    treated as an authenticity decision.
                  </p>
                ) : (
                  <p
                    className={`mt-2 flex items-center gap-2 text-sm font-medium ${
                      detail.idNameConsistent
                        ? "text-emerald-800"
                        : "text-amber-900"
                    }`}
                  >
                    {detail.idNameConsistent ? (
                      <CheckCircle className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                    )}
                    {detail.idNameConsistent
                      ? "Possible name match"
                      : "Possible name mismatch"}
                    <span className="font-normal text-slate-500">
                      · Hint only, not an authenticity decision
                    </span>
                  </p>
                )}
              </section>

              <div className="grid gap-4 sm:grid-cols-2">
                {(["front", "back"] as const).map(side => (
                  <figure
                    key={side}
                    className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white p-3"
                  >
                    <figcaption className="mb-3 flex items-center justify-between gap-2">
                      <span className="font-semibold capitalize text-slate-900">
                        {side} of ID
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500">
                        <ShieldCheck
                          className="h-3.5 w-3.5"
                          aria-hidden="true"
                        />
                        Private preview
                      </span>
                    </figcaption>
                    {documentUrls[side] ? (
                      <img
                        src={documentUrls[side]}
                        alt={`${side} side of ${selected.name}'s ID`}
                        className="h-56 w-full rounded-xl bg-slate-100 object-contain sm:h-64"
                      />
                    ) : (
                      <div
                        role={isDocumentLoading ? "status" : "note"}
                        className={`flex h-56 items-center justify-center rounded-xl p-4 text-center text-sm sm:h-64 ${
                          isDocumentLoading
                            ? "animate-pulse bg-slate-100 text-slate-500"
                            : "bg-amber-50 text-amber-900"
                        }`}
                      >
                        {isDocumentLoading
                          ? "Loading protected image…"
                          : "This ID image is unavailable."}
                      </div>
                    )}
                  </figure>
                ))}
              </div>

              <section
                aria-labelledby="review-history-heading"
                className="rounded-2xl border border-slate-200 p-4 sm:p-5"
              >
                <div className="flex items-center justify-between gap-3">
                  <h4
                    id="review-history-heading"
                    className="font-semibold text-slate-900"
                  >
                    Previous decisions
                  </h4>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                    {detail.reviews.length}{" "}
                    {detail.reviews.length === 1 ? "review" : "reviews"}
                  </span>
                </div>
                {detail.reviews.length === 0 ? (
                  <p className="mt-3 text-sm text-slate-600">
                    No previous review decisions.
                  </p>
                ) : (
                  <ol className="mt-4 space-y-3">
                    {detail.reviews.map(review => (
                      <li
                        key={review._id}
                        className="rounded-xl bg-slate-50 p-3 text-sm"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span
                            className={`inline-flex items-center gap-1.5 font-semibold ${
                              review.status === "verified"
                                ? "text-emerald-800"
                                : "text-red-800"
                            }`}
                          >
                            {review.status === "verified" ? (
                              <CheckCircle
                                className="h-4 w-4"
                                aria-hidden="true"
                              />
                            ) : (
                              <AlertTriangle
                                className="h-4 w-4"
                                aria-hidden="true"
                              />
                            )}
                            {review.status === "verified"
                              ? "Approved"
                              : "Rejected"}
                          </span>
                          <time
                            dateTime={review.reviewedAt}
                            className="text-xs text-slate-500"
                          >
                            {formatDate(review.reviewedAt)}
                          </time>
                        </div>
                        <p className="mt-1 break-all text-xs text-slate-500">
                          Reviewer ID: {review.reviewerId}
                        </p>
                        {review.reasonCode && (
                          <p className="mt-2 text-slate-700">
                            Reason: {reasonLabel(review.reasonCode)}
                          </p>
                        )}
                        {review.reasonNote && (
                          <p className="mt-1 whitespace-pre-wrap text-slate-700">
                            {review.reasonNote}
                          </p>
                        )}
                      </li>
                    ))}
                  </ol>
                )}
              </section>

              <section
                aria-labelledby="decision-heading"
                className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5"
              >
                <div>
                  <h4
                    id="decision-heading"
                    className="font-semibold text-slate-950"
                  >
                    Record a decision
                  </h4>
                  <p className="mt-1 text-sm text-slate-600">
                    Confirm both document sides before completing this review.
                  </p>
                </div>
                <p className="text-xs text-slate-500">
                  Shortcuts:{" "}
                  <kbd className="rounded border border-slate-300 bg-white px-1.5 py-0.5 font-semibold text-slate-700">
                    A
                  </kbd>{" "}
                  approve ·{" "}
                  <kbd className="rounded border border-slate-300 bg-white px-1.5 py-0.5 font-semibold text-slate-700">
                    R
                  </kbd>{" "}
                  rejection reason ·{" "}
                  <kbd className="rounded border border-slate-300 bg-white px-1.5 py-0.5 font-semibold text-slate-700">
                    Esc
                  </kbd>{" "}
                  close confirmation
                </p>
                <label
                  htmlFor="verification-reason"
                  className="block text-sm font-semibold text-slate-800"
                >
                  Rejection reason{" "}
                  <span className="text-red-700">(required to reject)</span>
                </label>
                <select
                  id="verification-reason"
                  ref={reasonSelectRef}
                  value={reasonCode}
                  onChange={event =>
                    setReasonCode(event.target.value as ReasonCode | "")
                  }
                  className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
                >
                  <option value="">Choose a reason</option>
                  {rejectionReasons.map(reason => (
                    <option key={reason.value} value={reason.value}>
                      {reason.label}
                    </option>
                  ))}
                </select>
                <div className="flex items-center justify-between gap-3">
                  <label
                    htmlFor="verification-note"
                    className="text-sm font-semibold text-slate-800"
                  >
                    Note for the applicant{" "}
                    <span className="font-normal text-slate-500">
                      (optional)
                    </span>
                  </label>
                  <span className="text-xs tabular-nums text-slate-500">
                    {reasonNote.length}/1000
                  </span>
                </div>
                <textarea
                  id="verification-note"
                  rows={3}
                  maxLength={1000}
                  value={reasonNote}
                  onChange={event => setReasonNote(event.target.value)}
                  placeholder="Add a short, respectful explanation to help the applicant resubmit correctly."
                  className="w-full resize-y rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-emerald-700"
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Button
                    disabled={
                      isReviewing ||
                      isDocumentLoading ||
                      !documentUrls.front ||
                      !documentUrls.back
                    }
                    onClick={() => setApproveConfirmOpen(true)}
                    className="min-h-11 bg-emerald-700 text-white hover:bg-emerald-800"
                  >
                    <CheckCircle className="mr-2 h-4 w-4" aria-hidden="true" />
                    Approve identity
                  </Button>
                  <Button
                    variant="destructive"
                    disabled={
                      isReviewing ||
                      isDocumentLoading ||
                      !documentUrls.front ||
                      !documentUrls.back ||
                      !reasonCode
                    }
                    onClick={() => void submitReview("reject")}
                    className="min-h-11"
                  >
                    {isReviewing ? (
                      <>
                        <Loader2
                          className="mr-2 h-4 w-4 animate-spin"
                          aria-hidden="true"
                        />
                        Saving…
                      </>
                    ) : (
                      <>
                        <AlertTriangle
                          className="mr-2 h-4 w-4"
                          aria-hidden="true"
                        />
                        Reject application
                      </>
                    )}
                  </Button>
                </div>
              </section>

              {isReviewing && (
                <p
                  role="status"
                  className="flex items-center gap-2 text-sm text-slate-600"
                >
                  <Clock className="h-4 w-4" aria-hidden="true" />
                  Saving your decision…
                </p>
              )}
            </>
          )}
        </div>
      </div>

      {approveConfirmOpen && selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
          onMouseDown={event => {
            if (event.target === event.currentTarget)
              setApproveConfirmOpen(false);
          }}
        >
          <section
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="approve-confirm-title"
            aria-describedby="approve-confirm-description"
            className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-800">
              <CheckCircle className="h-6 w-6" aria-hidden="true" />
            </span>
            <h2
              id="approve-confirm-title"
              className="mt-4 text-xl font-bold text-slate-950"
            >
              Confirm identity approval
            </h2>
            <p
              id="approve-confirm-description"
              className="mt-2 text-sm leading-6 text-slate-600"
            >
              You reviewed both ID images for{" "}
              <span className="font-semibold text-slate-900">
                {selected.name}
              </span>
              . Approving marks this identity as verified.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <Button
                variant="outline"
                onClick={() => setApproveConfirmOpen(false)}
              >
                Go back
              </Button>
              <Button
                autoFocus
                disabled={
                  isReviewing ||
                  isDocumentLoading ||
                  !documentUrls.front ||
                  !documentUrls.back
                }
                onClick={() => void submitReview("approve")}
                className="bg-emerald-700 text-white hover:bg-emerald-800"
              >
                {isReviewing ? (
                  <>
                    <Loader2
                      className="mr-2 h-4 w-4 animate-spin"
                      aria-hidden="true"
                    />
                    Saving…
                  </>
                ) : (
                  "Confirm approval"
                )}
              </Button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
