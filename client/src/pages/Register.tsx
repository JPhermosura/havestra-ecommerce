import { useState, useRef, useEffect } from "react";
import { Link } from "wouter";
import {
  Lock,
  User,
  Loader2,
  Eye,
  EyeOff,
  Phone,
  Camera,
  Upload,
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { validateIdImage } from "@/lib/idImageValidation";
import { ID_DOCUMENT_RETENTION_DAYS } from "@shared/const";
import IdCameraScanner from "@/components/IdCameraScanner";
import BrandMark from "@/components/BrandMark";

type RegistrationStep = "account" | "identity" | "farm";

function RegistrationStepper({ stepIndex }: { stepIndex: number }) {
  const steps = ["Account", "ID Verification", "Farm Details"];

  return (
    <ol
      aria-label="Registration progress"
      className="grid grid-cols-3"
    >
      {steps.map((step, index) => {
        const complete = index < stepIndex;
        const active = index === stepIndex;
        return (
          <li key={step} className="min-w-0 text-center">
            <div className="relative flex items-center justify-center">
              {index > 0 && (
                <span
                  aria-hidden="true"
                  className={`absolute right-1/2 top-1/2 h-0.5 w-full -translate-y-1/2 ${
                    index <= stepIndex ? "bg-[#65a76e]" : "bg-[#d9ddd1]"
                  }`}
                />
              )}
              {index < steps.length - 1 && (
                <span
                  aria-hidden="true"
                  className={`absolute left-1/2 top-1/2 h-0.5 w-full -translate-y-1/2 ${
                    index < stepIndex ? "bg-[#65a76e]" : "bg-[#d9ddd1]"
                  }`}
                />
              )}
              <span
                className={`relative z-10 flex h-6 w-6 items-center justify-center rounded-full border text-[11px] font-semibold ${
                  complete
                    ? "border-[#4d8b55] bg-[#4d8b55] text-white"
                    : active
                      ? "border-[#4d8b55] bg-[#4d8b55] text-white"
                      : "border-[#cbd1c4] bg-[#fffefa] text-slate-600"
                }`}
                aria-current={active ? "step" : undefined}
              >
                {complete ? <CheckCircle className="h-4 w-4" /> : index + 1}
              </span>
            </div>
            <span
              className={`mt-1.5 block truncate text-[10px] sm:text-xs ${
                active || complete
                  ? "font-semibold text-[#17231b]"
                  : "text-slate-500"
              }`}
            >
              {step}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export default function Register() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState<"buyer" | "seller">("buyer");
  const [farmName, setFarmName] = useState("");
  const [farmLocation, setFarmLocation] = useState("");
  const [idType, setIdType] = useState("Driver's License");
  const [idFrontImage, setIdFrontImage] = useState<File | null>(null);
  const [idBackImage, setIdBackImage] = useState<File | null>(null);
  const [frontPreviewUrl, setFrontPreviewUrl] = useState("");
  const [backPreviewUrl, setBackPreviewUrl] = useState("");
  const [scannerSide, setScannerSide] = useState<"front" | "back" | null>(
    null
  );
  const [registrationStep, setRegistrationStep] =
    useState<RegistrationStep>("account");
  const [idConsentAccepted, setIdConsentAccepted] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isProcessingIdImage, setIsProcessingIdImage] = useState(false);
  const isProcessingIdImageRef = useRef(false);
  const submitRequestedRef = useRef(false);
  const advanceScannerRef = useRef(false);
  const [isLoading, setIsLoading] = useState(false);
  const [registrationComplete, setRegistrationComplete] = useState(false);
  const [identitySubmitted, setIdentitySubmitted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const galleryInputRefs = useRef<
    Record<"front" | "back", HTMLInputElement | null>
  >({ front: null, back: null });
  const { register } = useAuth();

  useEffect(() => {
    if (!frontPreviewUrl) return;
    return () => URL.revokeObjectURL(frontPreviewUrl);
  }, [frontPreviewUrl]);

  useEffect(() => {
    if (!backPreviewUrl) return;
    return () => URL.revokeObjectURL(backPreviewUrl);
  }, [backPreviewUrl]);

  const hasAnyIdImage = Boolean(idFrontImage || idBackImage);
  const isPassport = idType === "Passport";
  const requiresIdSubmission = role === "seller" || hasAnyIdImage;
  const stepIndex = registrationStep === "account" ? 0 : registrationStep === "identity" ? 1 : 2;

  const handleIdImageSelection = async (
    file: File | undefined,
    side: "front" | "back"
  ): Promise<boolean> => {
    if (!file) return false;

    isProcessingIdImageRef.current = true;
    setIsProcessingIdImage(true);
    try {
      const previewUrl = await validateIdImage(file);
      if (side === "front") {
        setIdFrontImage(file);
        setFrontPreviewUrl(previewUrl);
        setErrors(current => ({ ...current, idFrontImage: "" }));
      } else {
        setIdBackImage(file);
        setBackPreviewUrl(previewUrl);
        setErrors(current => ({ ...current, idBackImage: "" }));
      }
      return true;
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not process that ID photo."
      );
      setErrors(current => ({
        ...current,
        [side === "front" ? "idFrontImage" : "idBackImage"]:
          `Choose a readable ${side} ID photo.`,
      }));
      return false;
    } finally {
      isProcessingIdImageRef.current = false;
      setIsProcessingIdImage(false);
    }
  };

  const removeIdImage = (side: "front" | "back") => {
    if (side === "front") {
      setIdFrontImage(null);
      setFrontPreviewUrl("");
    } else {
      setIdBackImage(null);
      setBackPreviewUrl("");
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = "Name is required";
    }

    if (!phone) {
      newErrors.phone = "Phone number is required";
    } else if (!/^09\d{9}$/.test(phone)) {
      newErrors.phone = "Phone number must start with 09 and contain 11 digits";
    }

    // email removed — phone is primary contact

    if (!password) {
      newErrors.password = "Password is required";
    } else if (password.length < 6) {
      newErrors.password = "Password must be at least 6 characters";
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = "Please confirm your password";
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }

    if (requiresIdSubmission) {
      if (!idType.trim()) {
        newErrors.idType = "Valid ID type is required";
      }
      if (!idFrontImage) {
        newErrors.idFrontImage = isPassport
          ? "Choose the passport information/photo page"
          : "Choose the front side of your ID";
      }
      if (!isPassport && !idBackImage) {
        newErrors.idBackImage = "Choose the back side of your ID";
      }
      if (!idConsentAccepted) {
        newErrors.idConsent = "Consent is required to submit ID photos.";
      }
    }

    if (!termsAccepted) {
      newErrors.termsAccepted = "Please accept the Terms of Service and Privacy Policy.";
    }

    if (role === "seller") {
      if (!farmName.trim()) {
        newErrors.farmName = "Farm name is required for sellers";
      }
      if (!farmLocation.trim()) {
        newErrors.farmLocation = "Farm location is required for sellers";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateAccountStep = () => {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = "Name is required";
    if (!phone) {
      newErrors.phone = "Phone number is required";
    } else if (!/^09\d{9}$/.test(phone)) {
      newErrors.phone = "Phone number must start with 09 and contain 11 digits";
    }
    if (!password) {
      newErrors.password = "Password is required";
    } else if (password.length < 6) {
      newErrors.password = "Password must be at least 6 characters";
    }
    if (!confirmPassword) {
      newErrors.confirmPassword = "Please confirm your password";
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateIdentityStep = () => {
    const newErrors: Record<string, string> = {};
    if (requiresIdSubmission) {
      if (!idType.trim()) newErrors.idType = "Valid ID type is required";
      if (!idFrontImage) {
        newErrors.idFrontImage = isPassport
          ? "Choose the passport information/photo page"
          : "Choose the front side of your ID";
      }
      if (!isPassport && !idBackImage) {
        newErrors.idBackImage = "Choose the back side of your ID";
      }
      if (!idConsentAccepted) {
        newErrors.idConsent = "Consent is required to submit ID photos.";
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const acceptScannedImage = async (file: File) => {
    if (!scannerSide) return false;
    const side = scannerSide;
    const accepted = await handleIdImageSelection(file, side);
    if (accepted && side === "front" && !isPassport) {
      advanceScannerRef.current = true;
    }
    return accepted;
  };

  const closeScanner = () => {
    const nextSide = advanceScannerRef.current ? "back" : null;
    advanceScannerRef.current = false;
    setScannerSide(nextSide);
  };

  const handleGallerySelection = async (
    file: File | undefined,
    side: "front" | "back"
  ) => {
    await handleIdImageSelection(file, side);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const explicitlyRequested = submitRequestedRef.current;
    submitRequestedRef.current = false;
    if (!explicitlyRequested) return;
    if (isProcessingIdImageRef.current) {
      toast.info("Please wait for the ID photo check to finish.");
      return;
    }

    if (!validateForm()) return;

    setIsLoading(true);
    try {
      await register(
        phone,
        password,
        name,
        role,
        undefined,
        farmName,
        farmLocation,
        requiresIdSubmission ? idType : undefined,
        idFrontImage || undefined,
        isPassport ? undefined : idBackImage || undefined,
        idConsentAccepted,
        setUploadProgress
      );
      setIdentitySubmitted(requiresIdSubmission);
      setRegistrationComplete(true);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Registration failed"
      );
    } finally {
      setIsLoading(false);
      setUploadProgress(0);
    }
  };

  if (isLoading) {
    const progress = Math.max(0, Math.min(100, uploadProgress));
    return (
      <main className="verification-theme relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-8">
        <BrandMark className="pointer-events-none absolute -bottom-5 -right-4 h-36 w-36 rotate-[-18deg] text-[#4d8b55]/15 sm:h-52 sm:w-52" />
        <section className="relative w-full max-w-sm rounded-[22px] border border-[#e1e4d8] bg-[#fffefa] px-7 py-9 text-center shadow-[0_12px_36px_rgba(34,65,41,0.12)] sm:px-10">
          <div
            className="mx-auto flex h-32 w-32 items-center justify-center rounded-full p-2"
            style={{
              background: `conic-gradient(#2c8a4c ${progress}%, #e5e7df ${progress}% 100%)`,
            }}
            aria-hidden="true"
          >
            <div className="flex h-full w-full items-center justify-center rounded-full bg-[#fffefa]">
              <BrandMark className="h-14 w-14 text-[#4d8b55]" />
            </div>
          </div>
          <h1 className="mt-5 text-2xl font-bold tracking-tight text-[#17231b]">
            {requiresIdSubmission ? "Uploading..." : "Creating account..."}
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {requiresIdSubmission
              ? "Securely storing your ID. Please keep this page open."
              : "Setting up your Havestra account."}
          </p>
          <div
            className="mt-7 h-2.5 overflow-hidden rounded-full bg-[#e5e7df]"
            role="progressbar"
            aria-label={requiresIdSubmission ? "Secure ID upload" : "Account creation"}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#237c43] to-[#4d9b5b] transition-[width] duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-2 text-xs font-medium text-slate-500">
            {progress}% complete
          </p>
        </section>
      </main>
    );
  }

  if (registrationComplete) {
    return (
      <main className="verification-theme relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-8">
        <BrandMark className="pointer-events-none absolute -left-7 top-8 h-40 w-40 rotate-[-28deg] text-[#4d8b55]/15 sm:h-56 sm:w-56" />
        <BrandMark className="pointer-events-none absolute -bottom-5 -right-4 h-40 w-40 rotate-[22deg] text-[#4d8b55]/15 sm:h-56 sm:w-56" />
        <section className="relative w-full max-w-md rounded-[22px] border border-[#e1e4d8] bg-[#fffefa] px-6 py-9 text-center shadow-[0_12px_36px_rgba(34,65,41,0.12)] sm:px-10 sm:py-11">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-[#21814a] to-[#48a160] text-white shadow-[0_8px_24px_rgba(33,129,74,0.24)]">
            <CheckCircle className="h-11 w-11" strokeWidth={2.5} />
          </div>
          <h1 className="mt-5 text-2xl font-bold tracking-tight text-[#17231b] sm:text-[28px]">
            {identitySubmitted
              ? "ID Verification Complete"
              : "Registration Complete"}
          </h1>
          <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-slate-700">
            {identitySubmitted
              ? "Your ID has been successfully submitted and is under review."
              : "Your account is ready. ID verification is optional for buyer accounts."}
          </p>
          {identitySubmitted && (
            <div className="mt-5 flex items-center gap-3 rounded-xl bg-[#e5f2df] px-4 py-3 text-left text-xs leading-5 text-[#234b2d]">
              <ShieldCheck className="h-5 w-5 shrink-0 text-[#2b7841]" />
              <span>You&apos;ll be notified once the review is complete.</span>
            </div>
          )}
          <Button
            asChild
            className="mt-6 min-h-12 w-full rounded-xl bg-[#205b35] text-base text-white hover:bg-[#17472a]"
          >
            <Link href="/login">Continue to sign in</Link>
          </Button>
        </section>
      </main>
    );
  }

  return (
    <main className="verification-theme relative flex min-h-dvh items-center justify-center overflow-hidden px-3 py-5 sm:px-6 sm:py-8">
      <BrandMark className="pointer-events-none absolute -bottom-5 -right-4 h-32 w-32 rotate-[22deg] text-[#4d8b55]/15 sm:h-48 sm:w-48" />
      <div className="relative z-10 w-full max-w-md">
        <header className="mb-4 flex items-center justify-between gap-4 px-1">
          <Link href="/" className="flex items-center gap-2 text-[#172d1d]">
            <BrandMark className="h-9 w-9 text-[#4d8b55]" />
            <span className="text-xl font-bold tracking-tight">Havestra</span>
          </Link>
          <p className="text-right text-[11px] font-medium text-[#31513a] sm:text-xs">
            Fresh from local growers
          </p>
        </header>

        <section className="rounded-[18px] border border-[#d9ddd1] bg-[#fffefa] p-4 shadow-[0_12px_34px_rgba(34,65,41,0.11)] sm:p-6">
          <RegistrationStepper stepIndex={stepIndex} />
          <header className="mb-5 mt-5">
            <h1 className="text-[22px] font-bold leading-tight tracking-tight text-[#17231b]">
              {registrationStep === "account"
                ? "Create your account"
                : registrationStep === "identity"
                  ? "Government ID Verification"
                  : role === "seller"
                    ? "Farm Details"
                    : "Finish Registration"}
            </h1>
            <p className="mt-1.5 text-sm leading-5 text-slate-600">
              {registrationStep === "account"
                ? "Start with your account information."
                : registrationStep === "identity"
                  ? "Submit clear photos of your ID. Sellers must be verified before publishing products."
                  : role === "seller"
                    ? "Tell buyers a little about your farm."
                    : "Review your details and finish creating your account."}
            </p>
          </header>

          <form onSubmit={handleSubmit} className="space-y-4">
            {registrationStep === "account" && (
              <>
            {/* Name Field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Full Name
              </label>
              <div className="relative">
                <User
                  className="absolute left-3 top-3 text-gray-400"
                  size={18}
                />
                <Input
                  type="text"
                  value={name}
                  onChange={e => {
                    setName(e.target.value);
                    if (errors.name) setErrors({ ...errors, name: "" });
                  }}
                  placeholder="John Doe"
                  className="min-h-11 w-full border-gray-200 pl-10 focus:border-[#245c3a] focus:ring-[#245c3a]"
                />
              </div>
              {errors.name && (
                <p className="text-red-500 text-xs mt-1">{errors.name}</p>
              )}
            </div>

            {/* Phone Number Field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Phone Number
              </label>
              <div className="relative">
                <Phone
                  className="absolute left-3 top-3 text-gray-400"
                  size={18}
                />
                <Input
                  type="tel"
                  value={phone}
                  onChange={e => {
                    setPhone(e.target.value);
                    if (errors.phone) setErrors({ ...errors, phone: "" });
                  }}
                  placeholder="09171234567"
                  className="min-h-11 w-full border-gray-200 pl-10 focus:border-[#245c3a] focus:ring-[#245c3a]"
                />
              </div>
              {errors.phone && (
                <p className="text-red-500 text-xs mt-1">{errors.phone}</p>
              )}
            </div>

            {/* Email removed — using phone as primary contact */}

            {/* Password Field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <Lock
                  className="absolute left-3 top-3 text-gray-400"
                  size={18}
                />
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={e => {
                    setPassword(e.target.value);
                    if (errors.password) setErrors({ ...errors, password: "" });
                  }}
                  placeholder="••••••••"
                  className="min-h-11 w-full border-gray-200 pl-10 pr-10 focus:border-[#245c3a] focus:ring-[#245c3a]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.password && (
                <p className="text-red-500 text-xs mt-1">{errors.password}</p>
              )}
            </div>

            {/* Confirm Password Field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Confirm Password
              </label>
              <div className="relative">
                <Lock
                  className="absolute left-3 top-3 text-gray-400"
                  size={18}
                />
                <Input
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={e => {
                    setConfirmPassword(e.target.value);
                    if (errors.confirmPassword)
                      setErrors({ ...errors, confirmPassword: "" });
                  }}
                  placeholder="••••••••"
                  className="min-h-11 w-full border-gray-200 pl-10 pr-10 focus:border-[#245c3a] focus:ring-[#245c3a]"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label={
                    showConfirmPassword
                      ? "Hide confirm password"
                      : "Show confirm password"
                  }
                  className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                >
                  {showConfirmPassword ? (
                    <EyeOff size={18} />
                  ) : (
                    <Eye size={18} />
                  )}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="text-red-500 text-xs mt-1">
                  {errors.confirmPassword}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Account type
              </label>
              <select
                value={role}
                onChange={e => setRole(e.target.value as "buyer" | "seller")}
                className="min-h-11 w-full rounded-xl border border-gray-200 bg-white px-4 py-2 text-base focus:border-[#245c3a] focus:outline-none focus:ring-[#245c3a]"
              >
                <option value="buyer">Buyer</option>
                <option value="seller">Seller</option>
              </select>
            </div>
              </>
            )}

            {registrationStep === "identity" && (
              <section className="min-w-0 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#4d8b55]">
                    Identity document
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-[#e7f0e5] px-3 py-1 text-xs font-bold text-[#245c3a]">
                  {role === "seller" ? "Required" : "Optional"}
                </span>
              </div>
              <p className="text-xs leading-5 text-slate-600">
                Accepted ID types: Driver&apos;s License, Passport, National ID,
                Company ID, and Other.
              </p>
              <div>
                <label
                  htmlFor="registration-id-type"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  ID Type <span className="text-red-600">*</span>
                </label>
                <select
                  id="registration-id-type"
                  value={idType}
                  onChange={event => {
                    const selectedType = event.target.value;
                    setIdType(selectedType);
                    if (selectedType === "Passport") {
                      setIdBackImage(null);
                      setBackPreviewUrl("");
                    }
                    setErrors(current => ({
                      ...current,
                      idType: "",
                      ...(selectedType === "Passport"
                        ? { idBackImage: "" }
                        : {}),
                    }));
                  }}
                  className="min-h-11 w-full rounded-xl border border-[#cbd8c9] bg-white px-4 py-2 text-sm focus:border-[#245c3a] focus:outline-none focus:ring-[#245c3a]"
                >
                  <option value="Driver's License">Driver's License</option>
                  <option value="Passport">Passport</option>
                  <option value="National ID">National ID</option>
                  <option value="Company ID">Company ID</option>
                  <option value="Other">Other</option>
                </select>
                {errors.idType && (
                  <p className="mt-1 text-xs text-red-600">{errors.idType}</p>
                )}
              </div>

              <div className="rounded-xl border border-[#d7e8d2] bg-[#e8f3e3] px-3 py-2.5 text-xs leading-5 text-[#234b2d]">
                <div className="flex items-start gap-2">
                  <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#2b7841]" />
                  <span>
                    {isPassport
                      ? "Only the passport information/photo page is required."
                      : "We’ll capture both front and back sides automatically."}
                  </span>
                </div>
              </div>

              {hasAnyIdImage && (
                <div className="grid gap-3 sm:grid-cols-2">
                  {(isPassport ? (["front"] as const) : (["front", "back"] as const)).map(side => {
                    const image = side === "front" ? idFrontImage : idBackImage;
                    const preview =
                      side === "front" ? frontPreviewUrl : backPreviewUrl;
                    const error =
                      side === "front" ? errors.idFrontImage : errors.idBackImage;
                    const sideLabel = isPassport
                      ? "Information/photo page"
                      : `${side} side`;
                    return (
                      <div
                        key={side}
                        className="min-w-0 rounded-xl border border-[#e0e4da] bg-white p-3 shadow-sm"
                      >
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <p className="text-xs font-semibold text-slate-800">
                            {sideLabel}
                          </p>
                          {image && (
                            <span className="text-[10px] font-semibold text-[#2b7841]">
                              READY
                            </span>
                          )}
                        </div>
                        <div className="flex aspect-[16/10] items-center justify-center overflow-hidden rounded-lg bg-[#f7f9f4]">
                          {preview ? (
                            <img
                              src={preview}
                              alt={`Preview of the ${sideLabel} of the ID`}
                              className="h-full w-full object-contain"
                            />
                          ) : (
                            <span className="text-xs text-slate-500">
                              No image selected
                            </span>
                          )}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={isProcessingIdImage}
                            onClick={() => setScannerSide(side)}
                            className="text-xs font-semibold text-[#245c3a] hover:underline disabled:opacity-50"
                          >
                            {image ? "Retake" : "Scan"}
                          </button>
                          <button
                            type="button"
                            disabled={isProcessingIdImage}
                            onClick={() =>
                              galleryInputRefs.current[side]?.click()
                            }
                            className="text-xs font-semibold text-[#245c3a] hover:underline disabled:opacity-50"
                          >
                            {image ? "Replace" : "Upload"}
                          </button>
                          {image && (
                            <button
                              type="button"
                              disabled={isProcessingIdImage}
                              onClick={() => removeIdImage(side)}
                              className="text-xs font-semibold text-red-700 hover:underline disabled:opacity-50"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                        {error && (
                          <p className="mt-1 text-xs text-red-600">{error}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="grid gap-2">
                <Button
                  type="button"
                  disabled={isProcessingIdImage}
                  onClick={() =>
                    setScannerSide(
                      isPassport
                        ? "front"
                        : !idFrontImage
                          ? "front"
                          : "back"
                    )
                  }
                  className="min-h-11 w-full rounded-xl bg-[#205b35] text-sm text-white hover:bg-[#17472a]"
                >
                  <Camera className="h-4 w-4" />
                  {hasAnyIdImage ? "Scan with Camera" : "Scan with Camera"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={isProcessingIdImage}
                  onClick={() =>
                    galleryInputRefs.current[
                      isPassport || !idFrontImage ? "front" : "back"
                    ]?.click()
                  }
                  className="min-h-11 w-full rounded-xl border-[#c9cec2] bg-transparent text-sm text-[#202920] hover:bg-[#f5f7ef]"
                >
                  <Upload className="h-4 w-4" />
                  Upload from Device
                </Button>
              </div>
              {(["front", "back"] as const).map(side => (
                <input
                  key={side}
                  ref={element => {
                    galleryInputRefs.current[side] = element;
                  }}
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                  onChange={event => {
                    void handleGallerySelection(
                      event.currentTarget.files?.[0],
                      side
                    );
                    event.currentTarget.value = "";
                  }}
                  className="hidden"
                  aria-label={`Upload ${side} side of government ID`}
                />
              ))}
              {isProcessingIdImage && (
                <p role="status" className="text-sm text-slate-600">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin text-[#245c3a]" />
                  Checking selected ID image…
                </p>
              )}
              <p className="flex items-start gap-2 text-[11px] leading-5 text-slate-500">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#4d8b55]" />
                <span>
                  Your ID is securely stored for up to {ID_DOCUMENT_RETENTION_DAYS} days.
                  An authorized review is required; image capture does not verify authenticity.
                </span>
              </p>
              {(role === "seller" || hasAnyIdImage) && (
                <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-[#e0e4da] bg-white p-3 text-xs leading-5 text-slate-700">
                  <input
                    type="checkbox"
                    checked={idConsentAccepted}
                    onChange={event => {
                      setIdConsentAccepted(event.target.checked);
                      setErrors(current => ({ ...current, idConsent: "" }));
                    }}
                    className="mt-0.5 h-5 w-5 shrink-0 accent-[#245c3a]"
                  />
                  <span>
                    I consent to secure processing of my ID image(s) for identity review.
                  </span>
                </label>
              )}
              {errors.idConsent && (
                <p className="text-xs text-red-600">{errors.idConsent}</p>
              )}
              </section>
            )}

            {registrationStep === "farm" && (
              <>
                {role === "seller" && (
                  <>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        Farm Name <span className="text-red-600">*</span>
                      </label>
                      <Input
                        type="text"
                        value={farmName}
                        onChange={event => {
                          setFarmName(event.target.value);
                          if (errors.farmName)
                            setErrors({ ...errors, farmName: "" });
                        }}
                        placeholder="Sunrise Farms"
                        className="min-h-11 w-full rounded-xl border-[#cbd8c9] focus:border-[#245c3a] focus:ring-[#245c3a]"
                      />
                      {errors.farmName && (
                        <p className="mt-1 text-xs text-red-600">
                          {errors.farmName}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        Farm Location <span className="text-red-600">*</span>
                      </label>
                      <Input
                        type="text"
                        value={farmLocation}
                        onChange={event => {
                          setFarmLocation(event.target.value);
                          if (errors.farmLocation)
                            setErrors({ ...errors, farmLocation: "" });
                        }}
                        placeholder="Western Visayas"
                        className="min-h-11 w-full rounded-xl border-[#cbd8c9] focus:border-[#245c3a] focus:ring-[#245c3a]"
                      />
                      {errors.farmLocation && (
                        <p className="mt-1 text-xs text-red-600">
                          {errors.farmLocation}
                        </p>
                      )}
                    </div>
                  </>
                )}
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#e0e4da] bg-white p-3 text-sm leading-5 text-slate-700">
                  <input
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={event => {
                      setTermsAccepted(event.target.checked);
                      setErrors(current => ({ ...current, termsAccepted: "" }));
                    }}
                    className="mt-0.5 h-5 w-5 shrink-0 accent-[#245c3a]"
                  />
                  <span>
                    I agree to the{" "}
                    <a
                      href="#"
                      className="font-medium text-[#245c3a] hover:text-[#1b482d]"
                    >
                      Terms of Service
                    </a>{" "}
                    and{" "}
                    <a
                      href="#"
                      className="font-medium text-[#245c3a] hover:text-[#1b482d]"
                    >
                      Privacy Policy
                    </a>
                    .
                  </span>
                </label>
                {errors.termsAccepted && (
                  <p className="text-xs text-red-600">{errors.termsAccepted}</p>
                )}
              </>
            )}

            <div className="mt-5 flex items-center gap-3">
              {registrationStep !== "account" && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    setRegistrationStep(
                      registrationStep === "farm" ? "identity" : "account"
                    )
                  }
                  className="min-h-11 rounded-xl border-[#c9cec2] px-4 text-[#263329]"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Button>
              )}
              {registrationStep === "account" && (
                <Button
                  type="button"
                  onClick={() => {
                    if (validateAccountStep()) setRegistrationStep("identity");
                  }}
                  className="min-h-11 flex-1 rounded-xl bg-[#205b35] text-white hover:bg-[#17472a]"
                >
                  Continue
                  <ArrowRight className="h-4 w-4" />
                </Button>
              )}
              {registrationStep === "identity" && (
                <Button
                  type="button"
                  disabled={isProcessingIdImage}
                  onClick={() => {
                    if (validateIdentityStep()) setRegistrationStep("farm");
                  }}
                  className="min-h-11 flex-1 rounded-xl bg-[#205b35] text-white hover:bg-[#17472a]"
                >
                  Continue
                  <ArrowRight className="h-4 w-4" />
                </Button>
              )}
              {registrationStep === "farm" && (
                <Button
                  type="submit"
                  disabled={isProcessingIdImage}
                  onClick={() => {
                    submitRequestedRef.current = true;
                  }}
                  className="min-h-11 flex-1 rounded-xl bg-[#205b35] text-white hover:bg-[#17472a]"
                >
                  Create Account
                  <ArrowRight className="h-4 w-4" />
                </Button>
              )}
            </div>
            {registrationStep === "identity" && role === "buyer" && (
              <p className="text-center text-[11px] leading-5 text-slate-500">
                ID submission is optional for buyers. Continue without a document if you prefer.
              </p>
            )}
          </form>

          {scannerSide && (
            <IdCameraScanner
              documentType={idType}
              sideLabel={
                isPassport
                  ? "passport information/photo page"
                  : `${scannerSide} side`
              }
              onAccept={acceptScannedImage}
              onClose={closeScanner}
              onUseUpload={() => {
                const side = scannerSide;
                setScannerSide(null);
                galleryInputRefs.current[side]?.click();
              }}
            />
          )}

          <p className="mt-5 text-center text-xs text-slate-600">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-semibold text-[#245c3a] hover:text-[#1b482d]"
            >
              Sign in
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}
