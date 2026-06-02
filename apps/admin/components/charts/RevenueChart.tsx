'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
} from 'recharts';

export interface RevenuePoint {
  month: string;   // ISO date — first of the month
  premium: number;
  total: number;
}

interface RevenueChartProps {
  data: RevenuePoint[];
}

const ROSE = '#C9A882';
const BORDER = 'rgba(139, 115, 85, 0.25)';

function formatMonth(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('en-US', { month: 'short', year: '2-digit' });
}

function formatTick(n: number) {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${n}`;
}

export function RevenueChart({ data }: RevenueChartProps) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
          <CartesianGrid stroke={BORDER} strokeDasharray="3 4" />
          <XAxis
            dataKey="month"
            tickFormatter={formatMonth}
            stroke="#A89880"
            tick={{ fontSize: 12 }}
          />
          <YAxis
            tickFormatter={formatTick}
            stroke="#A89880"
            tick={{ fontSize: 12 }}
            width={56}
          />
          <Tooltip
            formatter={(v: number) => [`$${v.toLocaleString('en-US')}`, '']}
            labelFormatter={(l: string) => formatMonth(l)}
            cursor={{ stroke: BORDER, strokeWidth: 1 }}
          />
          <Legend wrapperStyle={{ fontSize: 12, color: '#A89880' }} />
          <Line
            type="monotone"
            dataKey="total"
            name="MRR"
            stroke={ROSE}
            strokeWidth={2}
            dot={{ r: 3, fill: ROSE }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
