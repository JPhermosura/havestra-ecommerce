import React, { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: "buyer" | "seller" | "admin";
}

function normalizeRole(role: any): "buyer" | "seller" | "admin" {
  const rawRole = String(role ?? "buyer")
    .trim()
    .toLowerCase();
  if (rawRole === "seller" || rawRole === "buyer" || rawRole === "admin") {
    return rawRole as "buyer" | "seller" | "admin";
  }
  return "buyer";
}

export default function ProtectedRoute({
  children,
  requiredRole,
}: ProtectedRouteProps) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [location, navigate] = useLocation();
  const effectiveIsAuthenticated = isAuthenticated;
  const userRole = normalizeRole(user?.role);

  useEffect(() => {
    if (isLoading) return;
    if (!effectiveIsAuthenticated && location !== "/login") {
      navigate("/login", { replace: true });
      return;
    }
    if (
      effectiveIsAuthenticated &&
      requiredRole &&
      userRole !== requiredRole &&
      location !== "/unauthorized"
    ) {
      navigate("/unauthorized", { replace: true });
    }
  }, [
    effectiveIsAuthenticated,
    isLoading,
    location,
    navigate,
    requiredRole,
    userRole,
  ]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
          <p className="mt-4 text-gray-600">Loading authentication...</p>
        </div>
      </div>
    );
  }

  if (!effectiveIsAuthenticated) {
    return null;
  }

  if (requiredRole && userRole !== requiredRole) {
    return null;
  }

  return <>{children}</>;
}
