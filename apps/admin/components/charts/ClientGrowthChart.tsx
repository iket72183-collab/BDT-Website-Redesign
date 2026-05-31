'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from 'recharts';

export interface GrowthPoint {
  month: string;   // ISO date — first of the month
  newClients: number;
}

interface ClientGrowthChartProps {
  data: GrowthPoint[];
}

const ROSE = '#C9A882';
const BORDER = 'rgba(139, 115, 85, 0.25)';

function formatMonth(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('en-US', { month: 'short', year: '2-digit' });
}

export function ClientGrowthChart({ data }: ClientGrowthChartProps) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
          <CartesianGrid stroke={BORDER} strokeDasharray="3 4" />
          <XAxis
            dataKey="month"
            tickFormatter={formatMonth}
            stroke="#A89880"
            tick={{ fontSize: 12 }}
          />
          <YAxis allowDecimals={false} stroke="#A89880" tick={{ fontSize: 12 }} width={32} />
          <Tooltip
            formatter={(v: number) => [String(v), 'New clients']}
            labelFormatter={(l: string) => formatMonth(l)}
            cursor={{ fill: 'rgba(201, 168, 130, 0.08)' }}
          />
          <Bar dataKey="newClients" fill={ROSE} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
