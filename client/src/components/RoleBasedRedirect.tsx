import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";

export default function RoleBasedRedirect() {
  const { user, isLoading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!isLoading && user) {
      const role = String(user.role ?? "buyer")
        .trim()
        .toLowerCase();
      console.debug(
        "[RoleBasedRedirect] userRole:",
        role,
        "userContact:",
        user.phone || user.email
      );
      // Redirect users to their role-specific dashboard
      const destination = role === "seller" ? "/seller/dashboard" : role === "admin" ? "/admin" : "/buyer";
      navigate(destination, { replace: true });
    }
  }, [user, isLoading, navigate]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
        <p className="mt-4 text-gray-600">Redirecting...</p>
      </div>
    </div>
  );
}
