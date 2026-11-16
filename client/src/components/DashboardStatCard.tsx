import React from "react";
import { LucideIcon } from "lucide-react";

export default function DashboardStatCard({
  title,
  value,
  IconComponent,
  color = "from-emerald-500 to-emerald-600",
  trend,
  trendValue,
}: {
  title: string;
  value: string | number;
  IconComponent: LucideIcon | any;
  color?: string;
  trend?: "up" | "down";
  trendValue?: string;
}) {
  return (
    <div className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 p-6 border border-slate-100">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
        </div>
        <div className={`p-3 bg-gradient-to-br ${color} rounded-xl`}> 
          <IconComponent className="h-6 w-6 text-white" />
        </div>
      </div>
      {trend && (
        <div className={`text-sm font-medium ${trend === "up" ? "text-emerald-600" : "text-red-600"}`}>
          {trendValue}
        </div>
      )}
    </div>
  );
}
