import { ArrowLeft } from "lucide-react";
import { Link } from "wouter";

interface BackToHomeLinkProps {
  showLabel?: boolean;
}

export default function BackToHomeLink({
  showLabel = false,
}: BackToHomeLinkProps) {
  return (
    <Link
      href="/"
      aria-label="Back to Havestra home"
      title="Back to Havestra home"
      className="inline-flex h-9 shrink-0 items-center justify-center gap-1 rounded-full border border-emerald-200/80 bg-white/85 px-2 text-xs font-semibold text-emerald-900 shadow-sm transition-colors hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
    >
      <ArrowLeft size={16} aria-hidden="true" />
      {showLabel ? (
        <span className="max-[360px]:hidden">Back</span>
      ) : (
        <span className="hidden sm:inline">Back</span>
      )}
    </Link>
  );
}
