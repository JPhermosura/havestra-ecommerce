import { AlertTriangle, CheckCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

type VerificationStatus = "pending" | "pending_review" | "verified" | "rejected" | "not_submitted";
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

export default function VerificationStatusBanner({
  status,
  latestReasonCode,
  latestReasonNote,
  retryAllowed,
  onRetry,
}: {
  status: VerificationStatus;
  latestReasonCode?: RejectionReasonCode | null;
  latestReasonNote?: string | null;
  retryAllowed?: boolean;
  onRetry?: () => void;
}) {
  if (status === "verified") {
    return (
      <section role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-950">
        <div className="flex items-start gap-3">
          <CheckCircle className="mt-0.5 h-6 w-6 shrink-0 text-emerald-700" aria-hidden="true" />
          <div>
            <h2 className="text-lg font-semibold">Identity verified</h2>
            <p className="mt-1">Your identity has been verified and your account is active.</p>
          </div>
        </div>
      </section>
    );
  }

  if (status === "rejected") {
    return (
      <section role="alert" className="rounded-xl border-2 border-red-300 bg-red-50 p-5 text-red-950">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0 text-red-700" aria-hidden="true" />
          <div className="min-w-0">
            <h2 className="text-lg font-semibold">Your ID needs another review</h2>
            {latestReasonCode && (
              <p className="mt-1 font-medium">
                Reason: {reasonLabels[latestReasonCode] || "Other issue"}
              </p>
            )}
            {latestReasonNote && <p className="mt-2 whitespace-pre-wrap">{latestReasonNote}</p>}
            {retryAllowed && onRetry && (
              <Button className="mt-4" onClick={onRetry}>
                Try re-submitting your ID
              </Button>
            )}
          </div>
        </div>
      </section>
    );
  }

  if (status === "pending" || status === "pending_review") {
    return (
      <section role="status" className="rounded-xl border border-sky-200 bg-sky-50 p-5 text-sky-950">
        <div className="flex items-start gap-3">
          <Clock className="mt-0.5 h-6 w-6 shrink-0 text-sky-700" aria-hidden="true" />
          <div>
            <h2 className="text-lg font-semibold">Your documents are being reviewed</h2>
            <p className="mt-1">
              Your ID photos are securely stored and undergoing review by our platform team.
              We’ll update this page when a decision is made.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return null;
}
