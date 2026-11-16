import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";

export default function Unauthorized() {
  const [, navigate] = useLocation();

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-lg p-8 text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Access denied</h1>
        <p className="text-gray-600 mb-6">
          You do not have permission to view this page. Please sign in with the
          appropriate account or return to your dashboard.
        </p>
        <div className="flex gap-3 justify-center">
          <Button
            onClick={() => navigate("/login", { replace: true })}
            className="bg-emerald-500 hover:bg-emerald-600 text-white"
          >
            Sign in
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate("/", { replace: true })}
          >
            Go Home
          </Button>
        </div>
      </div>
    </div>
  );
}
