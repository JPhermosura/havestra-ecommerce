import { useEffect, useRef, useState } from "react";
import axios from "axios";
import {
  Camera,
  Loader2,
  RotateCcw,
  ShieldCheck,
  Trash2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { validateIdImage } from "@/lib/idImageValidation";
import { toast } from "sonner";
import VerificationStatusBanner from "@/components/VerificationStatusBanner";
import IdCameraScanner from "@/components/IdCameraScanner";

type VerificationStatus =
  | "not_submitted"
  | "pending"
  | "verified"
  | "pending_review"
  | "rejected";
type IdSide = "front" | "back";

export default function IdVerificationStatus() {
  const { user } = useAuth();
  const [status, setStatus] = useState<VerificationStatus>(
    user?.idVerificationStatus || "not_submitted"
  );
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);
  const [nameConsistent, setNameConsistent] = useState<boolean | null>(null);
  const [latestReasonCode, setLatestReasonCode] = useState<
    "blurry_image" | "name_mismatch" | "expired_document" | "unsupported_document" | "other" | null
  >(null);
  const [latestReasonNote, setLatestReasonNote] = useState<string | null>(null);
  const [retryAllowed, setRetryAllowed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [front, setFront] = useState<File | null>(null);
  const [back, setBack] = useState<File | null>(null);
  const [frontPreview, setFrontPreview] = useState("");
  const [backPreview, setBackPreview] = useState("");
  const [imageErrors, setImageErrors] = useState<Partial<Record<IdSide, string>>>({});
  const [consent, setConsent] = useState(false);
  const [scannerSide, setScannerSide] = useState<IdSide | null>(null);
  const uploadInputRefs = useRef<Record<IdSide, HTMLInputElement | null>>({
    front: null,
    back: null,
  });
  const isPassport = user?.idType?.toLowerCase() === "passport";

  const loadStatus = async () => {
    setLoadError("");
    try {
      const { data } = await axios.get("/api/auth/verification-status");
      setStatus(data.status);
      setSubmittedAt(data.submittedAt);
      setNameConsistent(data.nameConsistent);
      setRetryAllowed(Boolean(data.retryAllowed));
      setLatestReasonCode(data.latestReasonCode || null);
      setLatestReasonNote(data.latestReasonNote || null);
    } catch {
      setLoadError("Verification status could not be loaded. Try again.");
      toast.error("Could not load verification status.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadStatus();
  }, []);

  useEffect(() => {
    if (!frontPreview) return;
    return () => URL.revokeObjectURL(frontPreview);
  }, [frontPreview]);

  useEffect(() => {
    if (!backPreview) return;
    return () => URL.revokeObjectURL(backPreview);
  }, [backPreview]);

  const chooseImage = async (
    file: File | undefined,
    side: IdSide
  ): Promise<boolean> => {
    if (!file) return false;
    setIsProcessingImage(true);
    setImageErrors(current => ({ ...current, [side]: "" }));
    try {
      const preview = await validateIdImage(file);
      if (side === "front") {
        setFront(file);
        setFrontPreview(preview);
      } else {
        setBack(file);
        setBackPreview(preview);
      }
      return true;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not read that ID photo.";
      setImageErrors(current => ({ ...current, [side]: message }));
      toast.error(message);
      return false;
    } finally {
      setIsProcessingImage(false);
    }
  };

  const removeImage = (side: IdSide) => {
    if (side === "front") {
      setFront(null);
      setFrontPreview("");
    } else {
      setBack(null);
      setBackPreview("");
    }
    setImageErrors(current => ({ ...current, [side]: "" }));
  };

  const submitRetry = async () => {
    if (!front || (!isPassport && !back) || !consent) {
      toast.error(
        isPassport
          ? "Choose the passport information/photo page and accept the processing consent."
          : "Choose both ID photos and accept the processing consent."
      );
      return;
    }
    const formData = new FormData();
    formData.append("idFront", front);
    if (back) formData.append("idBack", back);
    formData.append("idConsent", "true");
    setIsSubmitting(true);
    try {
      const { data } = await axios.put("/api/auth/id-documents", formData, {
        onUploadProgress: event => {
          if (event.total)
            setUploadProgress(Math.round((event.loaded / event.total) * 100));
        },
      });
      setStatus(data.status);
      setRetryAllowed(false);
      setLatestReasonCode(null);
      setLatestReasonNote(null);
      setSubmittedAt(new Date().toISOString());
      setFront(null);
      setBack(null);
      setFrontPreview("");
      setBackPreview("");
      setConsent(false);
      toast.success(data.message || "ID resubmitted for review.");
    } catch (error) {
      const message = axios.isAxiosError(error)
        ? error.response?.data?.error
        : undefined;
      toast.error(message || "Could not resubmit your ID.");
    } finally {
      setIsSubmitting(false);
      setUploadProgress(0);
    }
  };

  return (
    <main className="verification-theme min-h-screen px-4 py-8 sm:px-6 lg:py-12">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="rounded-3xl bg-[#245c3a] px-5 py-6 text-white shadow-sm sm:px-8 sm:py-8">
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10">
              <ShieldCheck className="h-6 w-6" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-semibold text-[#dcebdd]">
                Account security
              </p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
                Identity verification
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/85">
                Manage your identity review securely. Only an authorized review
                or configured provider can confirm verification.
              </p>
            </div>
          </div>
        </header>

        {loadError && (
          <div
            role="alert"
            className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 sm:flex-row sm:items-center sm:justify-between"
          >
            <p>{loadError}</p>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsLoading(true);
                void loadStatus();
              }}
            >
              Try again
            </Button>
          </div>
        )}

        {isLoading ? (
          <div
            role="status"
            className="flex items-center gap-3 rounded-2xl border border-[#d7e4d7] bg-white p-5 text-sm text-slate-700 shadow-sm"
          >
            <Loader2 className="h-5 w-5 animate-spin text-[#245c3a]" />
            Loading verification status…
          </div>
        ) : (
          <VerificationStatusBanner
            status={status}
            latestReasonCode={latestReasonCode}
            latestReasonNote={latestReasonNote}
            retryAllowed={retryAllowed}
            submittedAt={submittedAt}
            nameConsistent={nameConsistent}
            heading="Identity verification status"
            onRetry={() =>
              document
                .getElementById("id-resubmission-upload")
                ?.scrollIntoView({ behavior: "smooth", block: "start" })
            }
          />
        )}

        {retryAllowed && (status === "rejected" || status === "pending_review") && (
          <section
            id="id-resubmission-upload"
            className="scroll-mt-6 space-y-6 rounded-3xl border border-[#d7e4d7] bg-white p-4 shadow-sm sm:p-6"
          >
            <div>
              <p className="text-sm font-semibold text-[#4d8b55]">
                Secure document upload
              </p>
              <h2 className="mt-1 text-xl font-bold text-slate-950">
                Resubmit ID {isPassport ? "page" : "photos"}
              </h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                {isPassport
                  ? "Provide a clear image of your passport information/photo page."
                  : "Provide clear, complete images of both sides of your ID."}{" "}
                JPG, JPEG, PNG, and WEBP are accepted.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {(isPassport ? (["front"] as const) : (["front", "back"] as const)).map(side => {
                const file = side === "front" ? front : back;
                const preview = side === "front" ? frontPreview : backPreview;
                const sideLabel = isPassport
                  ? "Information/photo page"
                  : `${side} side`;
                return (
                  <article
                    key={side}
                    className="min-w-0 rounded-2xl border border-[#dce5d8] bg-[#fbfcf8] p-4"
                  >
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <h3 className="text-sm font-bold text-slate-900">
                        {sideLabel}
                      </h3>
                      <span className="rounded-full bg-[#e7f0e5] px-2.5 py-1 text-xs font-semibold text-[#245c3a]">
                        Required
                      </span>
                    </div>
                    <div className="flex aspect-[16/10] items-center justify-center overflow-hidden rounded-xl border border-dashed border-[#c8d8c6] bg-white">
                      {preview ? (
                        <img
                          src={preview}
                          alt={`Selected ${sideLabel} of ID`}
                          className="h-full w-full object-contain"
                        />
                      ) : (
                        <div className="flex flex-col items-center gap-2 px-4 text-center text-sm text-slate-500">
                          <Camera className="h-7 w-7 text-[#4d8b55]" />
                          <span>No document selected</span>
                        </div>
                      )}
                    </div>
                    {file && (
                      <p className="mt-2 truncate text-xs text-slate-600">
                        {file.name}
                      </p>
                    )}
                    {imageErrors[side] && (
                      <p role="alert" className="mt-2 text-sm text-red-700">
                        {imageErrors[side]}
                      </p>
                    )}
                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                      <Button
                        type="button"
                        variant="outline"
                        disabled={isProcessingImage || isSubmitting}
                        onClick={() => setScannerSide(side)}
                        className="min-h-11 border-[#9db79f] text-[#245c3a] hover:bg-[#edf4eb]"
                      >
                        <Camera className="h-4 w-4" />
                        {file ? "Retake" : "Scan with camera"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={isProcessingImage || isSubmitting}
                        onClick={() => uploadInputRefs.current[side]?.click()}
                        className="min-h-11 border-[#9db79f] text-[#245c3a] hover:bg-[#edf4eb]"
                      >
                        <Upload className="h-4 w-4" />
                        {file ? "Replace" : "Upload"}
                      </Button>
                      {file && (
                        <Button
                          type="button"
                          variant="ghost"
                          disabled={isProcessingImage || isSubmitting}
                          onClick={() => removeImage(side)}
                          className="min-h-10 text-slate-700 hover:bg-red-50 hover:text-red-800 sm:col-span-2"
                        >
                          <Trash2 className="h-4 w-4" />
                          Remove image
                        </Button>
                      )}
                    </div>
                    <input
                      ref={element => {
                        uploadInputRefs.current[side] = element;
                      }}
                      type="file"
                      accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                      onChange={event => {
                        void chooseImage(event.currentTarget.files?.[0], side);
                        event.currentTarget.value = "";
                      }}
                      className="hidden"
                      aria-label={`Upload ${sideLabel} of ID from device`}
                    />
                  </article>
                );
              })}
            </div>

            {isProcessingImage && (
              <p role="status" className="text-sm text-slate-600">
                <Loader2 className="mr-2 inline h-4 w-4 animate-spin text-[#245c3a]" />
                Checking image quality…
              </p>
            )}

            <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-[#dce5d8] bg-[#fbfcf8] p-4 text-sm leading-6 text-slate-700">
              <input
                type="checkbox"
                checked={consent}
                onChange={event => setConsent(event.target.checked)}
                className="mt-1 h-4 w-4 shrink-0 accent-[#245c3a]"
              />
              <span>
                I consent to processing these replacement ID photos for identity
                review. OCR is only a consistency hint.
              </span>
            </label>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button
                type="button"
                disabled={
                  isSubmitting ||
                  isProcessingImage ||
                  !front ||
                  (!isPassport && !back) ||
                  !consent
                }
                onClick={() => void submitRetry()}
                className="min-h-11 bg-[#245c3a] text-white hover:bg-[#1b482d]"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Uploading {uploadProgress}%
                  </>
                ) : (
                  <>
                    <RotateCcw className="h-4 w-4" />
                    Resubmit for review
                  </>
                )}
              </Button>
            </div>
            {isSubmitting && (
              <progress
                className="h-2 w-full accent-[#245c3a]"
                max={100}
                value={uploadProgress}
                aria-label="ID resubmission upload progress"
              />
            )}
          </section>
        )}
      </div>
      {scannerSide && (
        <IdCameraScanner
          key={scannerSide}
          documentType={user?.idType || "Other"}
          sideLabel={
            isPassport
              ? "passport information/photo page"
              : `${scannerSide} side`
          }
          onAccept={file => chooseImage(file, scannerSide)}
          onClose={() => setScannerSide(null)}
          onUseUpload={() => {
            const side = scannerSide;
            setScannerSide(null);
            uploadInputRefs.current[side]?.click();
          }}
        />
      )}
    </main>
  );
}
