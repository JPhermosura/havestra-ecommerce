import { useState, useRef, useEffect } from "react";
import { Link } from "wouter";
import { Lock, User, Loader2, Eye, EyeOff, Phone, Camera } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { validateIdImage } from "@/lib/idImageValidation";
import { ID_DOCUMENT_RETENTION_DAYS } from "@shared/const";

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
  const [idConsentAccepted, setIdConsentAccepted] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [captureSide, setCaptureSide] = useState<"front" | "back">("front");
  const captureSideRef = useRef<"front" | "back">("front");
  const [isProcessingIdImage, setIsProcessingIdImage] = useState(false);
  const isProcessingIdImageRef = useRef(false);
  const submitRequestedRef = useRef(false);
  const [isLoading, setIsLoading] = useState(false);
  const [registrationComplete, setRegistrationComplete] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { register } = useAuth();

  const selectCaptureSide = (side: "front" | "back") => {
    captureSideRef.current = side;
    setCaptureSide(side);
  };

  useEffect(() => {
    if (!frontPreviewUrl) return;
    return () => URL.revokeObjectURL(frontPreviewUrl);
  }, [frontPreviewUrl]);

  useEffect(() => {
    if (!backPreviewUrl) return;
    return () => URL.revokeObjectURL(backPreviewUrl);
  }, [backPreviewUrl]);

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

    if (!idType.trim()) {
      newErrors.idType = "Valid ID type is required";
    }

    if (!idFrontImage) {
      newErrors.idFrontImage = "Please capture the front side of your ID";
    }

    if (!idBackImage) {
      newErrors.idBackImage = "Please capture the back side of your ID";
    }

    if (!idConsentAccepted) {
      newErrors.idConsent =
        "Please agree to the terms and consent to ID photo review.";
    }

    if (!termsAccepted) {
      newErrors.termsAccepted =
        "Please agree to the terms and consent to ID photo review.";
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const explicitlyRequested = submitRequestedRef.current;
    submitRequestedRef.current = false;
    if (!explicitlyRequested) return;
    if (isProcessingIdImageRef.current) {
      toast.info("Please wait for the ID photo check to finish.");
      return;
    }

    if (!validateForm() || !idFrontImage || !idBackImage) {
      return;
    }

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
        idType,
        idFrontImage,
        idBackImage,
        idConsentAccepted,
        setUploadProgress
      );
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

  if (registrationComplete) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-100 px-4 py-12">
        <div className="w-full max-w-lg rounded-[32px] bg-white p-8 text-center shadow-[0_30px_80px_rgba(15,23,42,0.08)] sm:p-10">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500 text-lg font-bold text-white">
            H
          </div>
          <h1 className="text-2xl font-bold text-slate-900">
            Registration submitted
          </h1>
          <p className="mt-3 text-slate-600">
            Your account was created and your identity review is pending. You
            can sign in with your phone number and password.
          </p>
          <Button asChild className="mt-6 w-full">
            <Link href="/login">Continue to sign in</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh items-start justify-center bg-gradient-to-br from-slate-50 via-white to-slate-100 px-3 py-6 sm:items-center sm:px-4 sm:py-12">
      <div className="w-full max-w-lg">
        {/* Card */}
        <div className="rounded-[24px] bg-white p-4 shadow-[0_30px_80px_rgba(15,23,42,0.08)] sm:rounded-[32px] sm:p-8 lg:p-10">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center text-white text-lg font-bold mx-auto mb-4">
              H
            </div>
            <h1 className="text-2xl font-bold text-slate-900">
              Create Account
            </h1>
            <p className="text-slate-500 text-sm mt-2">
              Register and start harvesting opportunities with Havestra.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
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
                  className="min-h-11 w-full border-gray-200 pl-10 focus:border-emerald-500 focus:ring-emerald-500"
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
                  className="min-h-11 w-full border-gray-200 pl-10 focus:border-emerald-500 focus:ring-emerald-500"
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
                  className="min-h-11 w-full border-gray-200 pl-10 pr-10 focus:border-emerald-500 focus:ring-emerald-500"
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
                  className="min-h-11 w-full border-gray-200 pl-10 pr-10 focus:border-emerald-500 focus:ring-emerald-500"
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
                className="min-h-11 w-full rounded-xl border border-gray-200 bg-white px-4 py-2 text-base focus:border-emerald-500 focus:outline-none focus:ring-emerald-500"
              >
                <option value="buyer">Buyer</option>
                <option value="seller">Seller</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ID type
              </label>
              <select
                value={idType}
                onChange={e => {
                  setIdType(e.target.value);
                  if (errors.idType) setErrors({ ...errors, idType: "" });
                }}
                className="min-h-11 w-full rounded-xl border border-gray-200 bg-white px-4 py-2 text-base focus:border-emerald-500 focus:outline-none focus:ring-emerald-500"
              >
                <option value="Driver's License">Driver's License</option>
                <option value="Passport">Passport</option>
                <option value="National ID">National ID</option>
                <option value="Company ID">Company ID</option>
                <option value="Other">Other</option>
              </select>
              {errors.idType && (
                <p className="text-red-500 text-xs mt-1">{errors.idType}</p>
              )}
            </div>

            <div className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50 p-3 shadow-sm sm:rounded-3xl sm:p-5">
              <div className="flex min-w-0 items-start gap-3 rounded-2xl bg-emerald-50 p-3 sm:rounded-3xl sm:p-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-emerald-600 shadow-sm">
                  <Camera size={20} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">
                    Capture your ID for review
                  </p>
                  <p className="text-sm text-slate-500">
                    Take clear photos of both sides. An administrator will
                    review them.
                  </p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-2 rounded-2xl border border-slate-200 bg-white p-3 min-[480px]:grid-cols-2 sm:mt-5 sm:gap-3 sm:rounded-3xl sm:p-4">
                {(["front", "back"] as const).map((side, index) => {
                  const isSelected = captureSide === side;
                  const hasImage =
                    side === "front"
                      ? Boolean(idFrontImage)
                      : Boolean(idBackImage);
                  return (
                    <button
                      key={side}
                      type="button"
                      onClick={() => selectCaptureSide(side)}
                      aria-pressed={isSelected}
                      className={`flex min-w-0 items-center gap-3 rounded-2xl border p-3 text-left transition ${
                        isSelected
                          ? "border-emerald-500 bg-emerald-50"
                          : "border-slate-200 hover:border-emerald-300"
                      }`}
                    >
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                          hasImage
                            ? "border border-emerald-500 text-emerald-600"
                            : isSelected
                              ? "bg-emerald-500 text-white"
                              : "border border-slate-300 text-slate-500"
                        }`}
                      >
                        {hasImage ? "✓" : index + 1}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-slate-900">
                          {side === "front" ? "Front side" : "Back side"}
                        </span>
                        <span className="block text-xs text-slate-500">
                          {hasImage
                            ? "Captured · tap to retake"
                            : "Not captured"}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="mt-4 rounded-3xl bg-emerald-50 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-emerald-600 shadow-sm">
                    <Camera size={18} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {captureSide === "front" ? "Step 1 of 2" : "Step 2 of 2"}
                    </p>
                    <p className="text-sm text-slate-500">
                      {captureSide === "front"
                        ? "Take a clear photo of the front of your ID."
                        : "Take a clear photo of the back of your ID."}
                    </p>
                  </div>
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                capture="environment"
                onClick={() => {
                  if (fileInputRef.current) {
                    fileInputRef.current.value = "";
                  }
                }}
                onChange={async e => {
                  const file = e.target.files?.[0];
                  if (!file) return;

                  const side = captureSideRef.current;
                  isProcessingIdImageRef.current = true;
                  setIsProcessingIdImage(true);
                  try {
                    const previewUrl = await validateIdImage(file);
                    if (side === "front") {
                      setIdFrontImage(file);
                      setFrontPreviewUrl(previewUrl);
                      if (errors.idFrontImage)
                        setErrors({ ...errors, idFrontImage: "" });
                      selectCaptureSide("back");
                    } else {
                      setIdBackImage(file);
                      setBackPreviewUrl(previewUrl);
                      if (errors.idBackImage)
                        setErrors({ ...errors, idBackImage: "" });
                    }
                  } catch (error) {
                    toast.error(
                      error instanceof Error
                        ? error.message
                        : "Could not process that ID photo."
                    );
                    if (side === "front")
                      setErrors({
                        ...errors,
                        idFrontImage: "Choose a readable front ID photo.",
                      });
                    else
                      setErrors({
                        ...errors,
                        idBackImage: "Choose a readable back ID photo.",
                      });
                  } finally {
                    isProcessingIdImageRef.current = false;
                    setIsProcessingIdImage(false);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }
                }}
                className="hidden"
              />
              <div className="mt-4 rounded-3xl border border-slate-200 bg-slate-900/5 p-4 relative">
                <div className="aspect-[16/9] overflow-hidden rounded-3xl bg-slate-200">
                  {captureSide === "front" ? (
                    frontPreviewUrl ? (
                      <img
                        src={frontPreviewUrl}
                        alt="Front of ID"
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-slate-500">
                        Front ID preview
                      </div>
                    )
                  ) : backPreviewUrl ? (
                    <img
                      src={backPreviewUrl}
                      alt="Back of ID"
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-slate-500">
                      Back ID preview
                    </div>
                  )}
                </div>
                <div className="mt-4 flex justify-center">
                  <button
                    type="button"
                    onClick={() => {
                      fileInputRef.current?.click();
                    }}
                    aria-label={`Capture ${captureSide} side of ID`}
                    className="inline-flex items-center justify-center rounded-full bg-emerald-500 px-5 py-4 text-white shadow-lg transition hover:bg-emerald-600"
                  >
                    <Camera size={20} />
                  </button>
                </div>
                <p className="mt-3 text-center text-sm text-slate-500">
                  Tap the camera button to capture or retake the {captureSide}{" "}
                  side.
                </p>
              </div>
              <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
                {idFrontImage && !idBackImage
                  ? "You’ll capture the back after the front side."
                  : idBackImage
                    ? "Both sides captured."
                    : "You’ll capture the back after the front side."}
              </div>
              <p className="mt-4 rounded-2xl bg-emerald-50 border border-emerald-100 px-4 py-3 text-sm text-emerald-700">
                Local OCR only checks whether your name may appear on the
                document. It does not verify authenticity; your ID remains
                pending review.
              </p>
              {errors.idFrontImage && (
                <p className="mt-3 text-red-500 text-xs">
                  {errors.idFrontImage}
                </p>
              )}
              {errors.idBackImage && (
                <p className="mt-2 text-red-500 text-xs">
                  {errors.idBackImage}
                </p>
              )}
            </div>

            <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-3 text-sm leading-5 text-slate-700 sm:p-4">
              <input
                type="checkbox"
                checked={idConsentAccepted && termsAccepted}
                onChange={e => {
                  setIdConsentAccepted(e.target.checked);
                  setTermsAccepted(e.target.checked);
                  if (errors.idConsent || errors.termsAccepted) {
                    setErrors({
                      ...errors,
                      idConsent: "",
                      termsAccepted: "",
                    });
                  }
                }}
                className="mt-0.5 h-5 w-5 shrink-0 accent-emerald-600"
              />
              <span className="min-w-0">
                I agree to the{" "}
                <a
                  href="#"
                  className="font-medium text-emerald-700 hover:text-emerald-900"
                >
                  Terms of Service
                </a>{" "}
                and{" "}
                <a
                  href="#"
                  className="font-medium text-emerald-700 hover:text-emerald-900"
                >
                  Privacy Policy
                </a>
                , and consent to ID photo processing for identity review. Photos
                are stored privately and deleted after{" "}
                {ID_DOCUMENT_RETENTION_DAYS} days; OCR text is not retained.
              </span>
            </label>
            {(errors.idConsent || errors.termsAccepted) && (
              <p className="text-red-500 text-xs">
                {errors.idConsent || errors.termsAccepted}
              </p>
            )}

            {role === "seller" && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Farm Name
                  </label>
                  <div className="relative">
                    <Input
                      type="text"
                      value={farmName}
                      onChange={e => {
                        setFarmName(e.target.value);
                        if (errors.farmName)
                          setErrors({ ...errors, farmName: "" });
                      }}
                      placeholder="Sunrise Farms"
                      className="w-full border-gray-200 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                  </div>
                  {errors.farmName && (
                    <p className="text-red-500 text-xs mt-1">
                      {errors.farmName}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Farm Location
                  </label>
                  <div className="relative">
                    <Input
                      type="text"
                      value={farmLocation}
                      onChange={e => {
                        setFarmLocation(e.target.value);
                        if (errors.farmLocation)
                          setErrors({ ...errors, farmLocation: "" });
                      }}
                      placeholder="Western Visayas"
                      className="w-full border-gray-200 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                  </div>
                  {errors.farmLocation && (
                    <p className="text-red-500 text-xs mt-1">
                      {errors.farmLocation}
                    </p>
                  )}
                </div>
              </>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={isLoading || isProcessingIdImage}
              onClick={() => {
                submitRequestedRef.current = true;
              }}
              className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-medium py-2 rounded-lg transition-all duration-200 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  {uploadProgress < 100
                    ? `Uploading ID photos ${uploadProgress}%...`
                    : "Checking photos and submitting..."}
                </>
              ) : (
                "Create Account"
              )}
            </Button>
            {isLoading && (
              <progress
                className="h-2 w-full accent-emerald-600"
                max={100}
                value={uploadProgress}
                aria-label="ID upload progress"
              />
            )}
          </form>

          {/* Sign In Link */}
          <p className="text-center text-sm text-gray-600 mt-6">
            Already have an account?{" "}
            <Link
              href="/login"
              className="text-emerald-600 hover:text-emerald-700 font-medium"
            >
              Sign in here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
