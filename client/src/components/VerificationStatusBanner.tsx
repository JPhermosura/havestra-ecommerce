import { AlertTriangle, CheckCircle, Clock, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

type VerificationStatus =
  | "pending"
  | "pending_review"
  | "verified"
  | "rejected"
  | "not_submitted";
type RejectionReasonCode =
  | "blurry_image"
  | "name_mismatch"
  | "expired_document"
  | "unsupported_document"
  | "other";

const reasonLabels: Record<RejectionReasonCode, string> = {
  blurry_image: "Blurry image",
  name_mismatch: "Name mismatch",
  expired_document: "Expired document",
  unsupported_document: "Unsupported document",
  other: "Other issue",
};

const stages = ["ID submitted", "Under review", "Decision"];

export default function VerificationStatusBanner({
  status,
  latestReasonCode,
  latestReasonNote,
  retryAllowed,
  submittedAt,
  nameConsistent,
  heading = "Identity verification",
  onRetry,
  onViewStatus,
}: {
  status: VerificationStatus;
  latestReasonCode?: RejectionReasonCode | null;
  latestReasonNote?: string | null;
  retryAllowed?: boolean;
  submittedAt?: string | null;
  nameConsistent?: boolean | null;
  heading?: string;
  onRetry?: () => void;
  onViewStatus?: () => void;
}) {
  const isApproved = status === "verified";
  const isRejected = status === "rejected";
  const isSubmitted = status !== "not_submitted";
  const completedStages = isApproved ? 3 : isRejected ? 2 : isSubmitted ? 1 : 0;
  const currentStage = isApproved
    ? -1
    : isRejected
      ? 2
      : isSubmitted
        ? 1
        : 0;
  const statusLabel = isApproved
    ? "Approved"
    : isRejected
      ? "Rejected"
      : isSubmitted
        ? "Pending"
        : "Not submitted";
  const Icon = isApproved
    ? CheckCircle
    : isRejected
      ? AlertTriangle
      : isSubmitted
        ? Clock
        : ShieldCheck;
  const tone = isApproved
    ? "border-[#cfe0d1] bg-[#f0f7ef]"
    : isRejected
      ? "border-amber-200 bg-amber-50"
      : "border-[#d7e4d7] bg-white";
  const iconTone = isApproved
    ? "bg-[#dcebdd] text-[#245c3a]"
    : isRejected
      ? "bg-amber-100 text-amber-800"
      : "bg-[#edf4eb] text-[#245c3a]";

  const message = isApproved
    ? "Your identity has been verified. Your seller account can continue using its approved features."
    : isRejected
      ? "Your ID needs an update before verification can be completed."
      : status === "pending"
        ? "Your documents are with the configured verification provider."
        : status === "pending_review"
          ? "Your documents are securely stored and awaiting an authorized review."
          : "Submit both sides of an accepted government ID to continue verification.";
  const submittedDate = submittedAt ? new Date(submittedAt) : null;
  const formattedSubmittedAt =
    submittedDate && !Number.isNaN(submittedDate.getTime())
      ? new Intl.DateTimeFormat(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
        }).format(submittedDate)
      : null;

  return (
    <section
      role={isRejected ? "alert" : "status"}
      aria-label={`${heading}: ${statusLabel}`}
      className={`rounded-3xl border p-5 shadow-sm sm:p-6 ${tone}`}
    >
      <div className="flex flex-col gap-5">
        <div className="flex items-start gap-4">
          <span
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${iconTone}`}
          >
            <Icon className="h-6 w-6" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-bold text-slate-950">{heading}</h2>
              <span
                className={`rounded-full px-3 py-1 text-xs font-bold ${
                  isApproved
                    ? "bg-[#245c3a] text-white"
                    : isRejected
                      ? "bg-amber-700 text-white"
                      : "bg-[#e4eee2] text-[#245c3a]"
                }`}
              >
                {statusLabel}
              </span>
            </div>
            <p className="mt-1 text-sm leading-6 text-slate-700">{message}</p>
            {formattedSubmittedAt && (
              <p className="mt-2 text-xs font-medium text-slate-600">
                Submitted {formattedSubmittedAt}
              </p>
            )}
            {status === "pending_review" && nameConsistent !== null && nameConsistent !== undefined && (
              <p className="mt-2 text-xs text-slate-600">
                Document name check: {nameConsistent ? "possible match" : "possible mismatch"}.
                This is not an authenticity decision.
              </p>
            )}
          </div>
        </div>

        <ol
          aria-label="Verification progress"
          className="grid grid-cols-3 gap-2 sm:gap-4"
        >
          {stages.map((stage, index) => {
            const completed = index < completedStages;
            const current = index === currentStage;
            return (
              <li
                key={stage}
                aria-current={current ? "step" : undefined}
                className="min-w-0"
              >
                <span
                  className={`mb-2 block h-1.5 rounded-full ${
                    completed
                      ? "bg-[#4d8b55]"
                      : current && isRejected
                        ? "bg-amber-500"
                        : current
                          ? "bg-[#245c3a]"
                          : "bg-[#dfe5dc]"
                  }`}
                />
                <span
                  className={`text-xs font-semibold ${
                    completed || current
                      ? "text-slate-800"
                      : "text-slate-500"
                  }`}
                >
                  {stage}
                </span>
              </li>
            );
          })}
        </ol>

        {isRejected && (latestReasonCode || latestReasonNote) && (
          <div className="rounded-2xl border border-amber-200 bg-white/80 p-4 text-sm text-slate-800">
            {latestReasonCode && (
              <p className="font-semibold">
                Reason: {reasonLabels[latestReasonCode] || "Other issue"}
              </p>
            )}
            {latestReasonNote && (
              <p className="mt-1 whitespace-pre-wrap">{latestReasonNote}</p>
            )}
          </div>
        )}

        {(onRetry || onViewStatus) && (
          <div className="flex flex-wrap gap-3">
            {retryAllowed && onRetry && (
              <Button
                type="button"
                onClick={onRetry}
                className="bg-[#245c3a] text-white hover:bg-[#1b482d]"
              >
                {isRejected ? "Resubmit ID" : "Continue verification"}
              </Button>
            )}
            {onViewStatus && (
              <Button
                type="button"
                variant="outline"
                onClick={onViewStatus}
                className="border-[#9db79f] bg-white text-[#245c3a] hover:bg-[#edf4eb]"
              >
                {status === "not_submitted"
                  ? "Start verification"
                  : "View verification details"}
              </Button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
