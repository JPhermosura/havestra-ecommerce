import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type RevenuePoint = {
  date: string;
  revenue: number;
};

export default function SellerRevenueChart({ data }: { data: RevenuePoint[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="date" tickLine={false} />
        <YAxis
          width={64}
          tickLine={false}
          tickFormatter={value => `₱${Number(value).toLocaleString()}`}
        />
        <Tooltip
          formatter={value => [`₱${Number(value).toLocaleString()}`, "Sales"]}
        />
        <Area
          type="monotone"
          dataKey="revenue"
          stroke="#059669"
          fill="#a7f3d0"
          fillOpacity={0.55}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
