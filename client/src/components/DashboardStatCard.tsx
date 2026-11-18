import type { LucideIcon } from "lucide-react";

type DashboardStatCardProps = {
  title: string;
  value: string | number;
  IconComponent: LucideIcon;
  color?: string;
  trend?: "up" | "down";
  trendValue?: string;
  onClick?: () => void;
};

export default function DashboardStatCard({
  title,
  value,
  IconComponent,
  color = "from-emerald-500 to-emerald-600",
  trend,
  trendValue,
  onClick,
}: DashboardStatCardProps) {
  const content = (
    <>
      <div className="flex items-center gap-3">
        <div>
          <p className="text-sm font-medium text-emerald-800">{title}</p>
          <p className="mt-2 text-2xl font-bold text-emerald-950 sm:text-3xl">
            {value}
          </p>
        </div>
        <div
          className={`ml-auto shrink-0 rounded-xl bg-gradient-to-br p-3 ${color}`}
        >
          <IconComponent className="h-5 w-5 text-white sm:h-6 sm:w-6" />
        </div>
      </div>
      {trend && (
        <div
          className={`mt-3 text-sm font-medium ${trend === "up" ? "text-emerald-700" : "text-red-600"}`}
        >
          {trendValue}
        </div>
      )}
    </>
  );
  const className =
    "dashboard-card h-full w-full rounded-2xl border border-emerald-100 bg-gradient-to-br from-white to-emerald-50 p-4 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md sm:p-5";

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${className} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600`}
      >
        {content}
      </button>
    );
  }

  return <div className={className}>{content}</div>;
}
