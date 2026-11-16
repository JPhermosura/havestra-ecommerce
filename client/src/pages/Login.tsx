import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Lock, Loader2, Eye, Phone } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

function normalizeRole(role: any): "buyer" | "seller" | "admin" {
  const rawRole = String(role ?? "buyer")
    .trim()
    .toLowerCase();
  if (rawRole === "seller" || rawRole === "buyer" || rawRole === "admin") {
    return rawRole as "buyer" | "seller" | "admin";
  }
  return "buyer";
}

function getDashboardPath(role?: "buyer" | "seller" | "admin") {
  if (role === "seller") return "/seller/dashboard";
  if (role === "admin") return "/admin";
  return "/buyer";
}

export default function Login() {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { login, user, isAuthenticated, isLoading } = useAuth();
  const [location, navigate] = useLocation();

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

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

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setErrors({}); // Clear any previous errors

    try {
      console.debug("[Login] submitting", { phone });
      const user = await login(phone, password);
      const destination = getDashboardPath(user.role);
      console.debug(
        "[Login] login successful, redirecting to",
        destination,
        "userRole:",
        user.role
      );
      toast.success(`Welcome back, ${user.name}!`);
      window.setTimeout(() => navigate(destination, { replace: true }), 0);
    } catch (error: any) {
      console.error("Login error:", error);

      // Handle different types of errors
      const errorMessage = error.message || "Login failed";

      // Set field-specific errors for better UX
      if (errorMessage.includes("phone number")) {
        setErrors({ phone: errorMessage });
      } else if (errorMessage.includes("password")) {
        setErrors({ password: errorMessage });
      } else {
        // Show toast for general errors
        toast.error(errorMessage);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    toast.info("Password reset is not available in the demo yet.");
  };

  const handleSocialLogin = async (provider: "Google" | "Facebook") => {
    setIsSubmitting(true);
    await new Promise(resolve => setTimeout(resolve, 800));
    toast("Social sign-in is not implemented in this demo.");
    setIsSubmitting(false);
  };

  useEffect(() => {
    const destination = getDashboardPath(user?.role);
    const effectiveIsAuthenticated = isAuthenticated;
    console.debug(
      "[Login] location",
      location,
      "user",
      user?.email,
      "role",
      user?.role,
      "effectiveIsAuthenticated",
      effectiveIsAuthenticated,
      "isAuthenticated",
      isAuthenticated,
      "isLoading",
      isLoading,
      "redirectTo",
      destination
    );
    if (isLoading) return;
    if (!effectiveIsAuthenticated) return;
    if (location.startsWith("/login") || location === "/") {
      navigate(destination, { replace: true });
    }
  }, [location, navigate, user, isAuthenticated, isLoading]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="text-center text-gray-700">
          Loading authentication...
        </div>
      </div>
    );
  }

  if (isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="text-center text-gray-700">
          Redirecting to your dashboard...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="bg-white rounded-lg shadow-lg p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-lg flex items-center justify-center text-white font-bold mx-auto mb-4">
              ✓
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Welcome Back</h1>
            <p className="text-gray-600 text-sm mt-2">
              Sign in to your Havestra account
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
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
                  className="pl-10 w-full border-gray-200 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
              {errors.phone && (
                <p className="text-red-500 text-xs mt-1">{errors.phone}</p>
              )}
            </div>

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
                  className="pl-10 pr-10 w-full border-gray-200 focus:ring-emerald-500 focus:border-emerald-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(s => !s)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3 top-2/4 -translate-y-2/4 text-gray-500 hover:text-gray-700"
                >
                  <Eye size={18} />
                </button>
              </div>
              {errors.password && (
                <p className="text-red-500 text-xs mt-1">{errors.password}</p>
              )}
            </div>

            {/* Role is auto-determined from email for demo flow */}

            {/* Forgot Password */}
            <div className="flex items-center justify-end text-sm">
              <a
                href="#"
                onClick={handleForgotPassword}
                className="text-emerald-600 hover:text-emerald-700 font-medium"
              >
                Forgot password?
              </a>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={isSubmitting || isLoading}
              className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-medium py-2 rounded-lg transition-all duration-200 flex items-center justify-center gap-2"
            >
              {isSubmitting || isLoading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign In"
              )}
            </Button>
          </form>

          {/* Divider */}
          <div className="my-6 flex items-center gap-4">
            <div className="flex-1 h-px bg-gray-200"></div>
            <span className="text-gray-500 text-sm">or</span>
            <div className="flex-1 h-px bg-gray-200"></div>
          </div>

          {/* Social Login */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => handleSocialLogin("Google")}
              className="border border-gray-200 rounded-lg py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Google
            </button>
            <button
              type="button"
              onClick={() => handleSocialLogin("Facebook")}
              className="border border-gray-200 rounded-lg py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Facebook
            </button>
          </div>

          {/* Sign Up Link */}
          <p className="text-center text-sm text-gray-600 mt-6">
            Don't have an account?{" "}
            <Link
              href="/register"
              className="text-emerald-600 hover:text-emerald-700 font-medium"
            >
              Sign up here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
