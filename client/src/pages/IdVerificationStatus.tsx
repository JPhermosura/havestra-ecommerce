import { useEffect, useState } from "react";
import axios from "axios";
import { AlertTriangle, Camera, CheckCircle, Clock, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { validateIdImage } from "@/lib/idImageValidation";
import { toast } from "sonner";
import VerificationStatusBanner from "@/components/VerificationStatusBanner";

type VerificationStatus = "not_submitted" | "pending" | "verified" | "pending_review" | "rejected";

const statusCopy: Record<VerificationStatus, { title: string; message: string }> = {
  not_submitted: { title: "ID not submitted", message: "Submit both sides of your ID to continue identity review." },
  pending: { title: "Provider review in progress", message: "Your ID is being reviewed by the configured identity provider. We will update this status when it finishes." },
  verified: { title: "Identity verified", message: "Your identity verification is complete." },
  pending_review: { title: "Pending review", message: "Your photos are stored securely. OCR can suggest whether your name appears on the document, but only a genuine provider result or authorized review can verify authenticity." },
  rejected: { title: "ID needs attention", message: "Your ID was not accepted. Review the photo requirements and securely resubmit both sides." },
};

export default function IdVerificationStatus() {
  const { user } = useAuth();
  const [status, setStatus] = useState<VerificationStatus>(user?.idVerificationStatus || "not_submitted");
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);
  const [nameConsistent, setNameConsistent] = useState<boolean | null>(null);
  const [latestReasonCode, setLatestReasonCode] = useState<
    "blurry_image" | "name_mismatch" | "expired_document" | "unsupported_document" | "other" | null
  >(null);
  const [latestReasonNote, setLatestReasonNote] = useState<string | null>(null);
  const [retryAllowed, setRetryAllowed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [front, setFront] = useState<File | null>(null);
  const [back, setBack] = useState<File | null>(null);
  const [frontPreview, setFrontPreview] = useState("");
  const [backPreview, setBackPreview] = useState("");
  const [consent, setConsent] = useState(false);

  useEffect(() => {
    let active = true;
    axios.get("/api/auth/verification-status")
      .then(({ data }) => {
        if (!active) return;
        setStatus(data.status);
        setSubmittedAt(data.submittedAt);
        setNameConsistent(data.nameConsistent);
        setRetryAllowed(Boolean(data.retryAllowed));
        setLatestReasonCode(data.latestReasonCode || null);
        setLatestReasonNote(data.latestReasonNote || null);
      })
      .catch(() => {
        if (active) toast.error("Could not load verification status.");
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => () => {
    if (frontPreview) URL.revokeObjectURL(frontPreview);
    if (backPreview) URL.revokeObjectURL(backPreview);
  }, [frontPreview, backPreview]);

  const chooseImage = async (file: File | undefined, side: "front" | "back") => {
    if (!file) return;
    try {
      const preview = await validateIdImage(file);
      if (side === "front") {
        setFront(file);
        setFrontPreview(preview);
      } else {
        setBack(file);
        setBackPreview(preview);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not read that ID photo.");
    }
  };

  const submitRetry = async () => {
    if (!front || !back || !consent) {
      toast.error("Choose both ID photos and accept the processing consent.");
      return;
    }
    const formData = new FormData();
    formData.append("idFront", front);
    formData.append("idBack", back);
    formData.append("idConsent", "true");
    setIsSubmitting(true);
    try {
      const { data } = await axios.put("/api/auth/id-documents", formData, {
        onUploadProgress: event => {
          if (event.total) setUploadProgress(Math.round((event.loaded / event.total) * 100));
        },
      });
      setStatus(data.status);
      setRetryAllowed(false);
      setLatestReasonCode(null);
      setLatestReasonNote(null);
      setSubmittedAt(new Date().toISOString());
      setFront(null);
      setBack(null);
      setConsent(false);
      toast.success(data.message || "ID resubmitted for review.");
    } catch (error) {
      const message = axios.isAxiosError(error) ? error.response?.data?.error : undefined;
      toast.error(message || "Could not resubmit your ID.");
    } finally {
      setIsSubmitting(false);
      setUploadProgress(0);
    }
  };

  const copy = statusCopy[status] || statusCopy.pending_review;
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <header>
          <p className="text-sm font-medium text-emerald-700">Account security</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Identity verification</h1>
          <p className="mt-2 text-slate-600">{copy.message}</p>
        </header>

        {!isLoading && (
          <VerificationStatusBanner
            status={status}
            latestReasonCode={latestReasonCode}
            latestReasonNote={latestReasonNote}
            retryAllowed={retryAllowed}
            onRetry={() => document.getElementById("id-resubmission-upload")?.scrollIntoView({ behavior: "smooth", block: "start" })}
          />
        )}

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm" aria-live="polite">
          <div className="flex items-start gap-3">
            {status === "verified" ? <CheckCircle className="mt-0.5 h-5 w-5 text-emerald-600" /> :
              status === "rejected" ? <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-600" /> :
                <Clock className="mt-0.5 h-5 w-5 text-sky-700" />}
            <div>
              <h2 className="font-semibold text-slate-900">{isLoading ? "Loading status..." : copy.title}</h2>
              {submittedAt && <p className="mt-1 text-sm text-slate-500">Submitted {new Date(submittedAt).toLocaleString()}</p>}
              {nameConsistent !== null && status === "pending_review" && (
                <p className="mt-2 text-sm text-slate-600">OCR name hint: {nameConsistent ? "possible match" : "possible mismatch"}. This is not an authenticity decision.</p>
              )}
            </div>
          </div>
        </section>

        {retryAllowed && (status === "rejected" || status === "pending_review") && (
          <section id="id-resubmission-upload" className="scroll-mt-6 space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-semibold text-slate-900">Resubmit ID photos</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {(["front", "back"] as const).map(side => {
                const preview = side === "front" ? frontPreview : backPreview;
                return (
                  <label key={side} className="block space-y-2 text-sm font-medium text-slate-700">
                    <span>{side === "front" ? "Front side" : "Back side"}</span>
                    {preview ? <img src={preview} alt={`Selected ID ${side}`} className="h-40 w-full rounded-lg bg-slate-100 object-contain" /> :
                      <span className="flex h-40 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-slate-500"><Camera className="mr-2 h-4 w-4" />Select a clear photo</span>}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      capture="environment"
                      className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-emerald-50 file:px-3 file:py-2 file:font-medium file:text-emerald-700"
                      onChange={event => void chooseImage(event.target.files?.[0], side)}
                    />
                  </label>
                );
              })}
            </div>
            <label className="flex items-start gap-3 text-sm text-slate-700">
              <input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} className="mt-1 h-4 w-4 accent-emerald-600" />
              <span>I consent to processing these replacement ID photos for identity review. OCR is only a consistency hint.</span>
            </label>
            <Button disabled={isSubmitting || !front || !back || !consent} onClick={() => void submitRetry()}>
              {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Uploading {uploadProgress}%</> : <><RotateCcw className="mr-2 h-4 w-4" />Resubmit ID</>}
            </Button>
            {isSubmitting && <progress className="block h-2 w-full accent-emerald-600" max={100} value={uploadProgress} aria-label="ID resubmission upload progress" />}
          </section>
        )}
      </div>
    </main>
  );
}