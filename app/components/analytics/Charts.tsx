'use client'

import {
  LineChart, Line, BarChart, Bar,
  CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'

interface WeeklyChartProps {
  data: { label: string; util: number }[]
}

export function WeeklyUtilChart({ data }: WeeklyChartProps) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10, fontFamily: 'DM Mono, monospace' }}
          interval="preserveStartEnd"
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          domain={[0, 100]}
          tickFormatter={v => `${v}%`}
          tick={{ fontSize: 10, fontFamily: 'DM Mono, monospace' }}
          tickLine={false}
          axisLine={false}
          width={36}
        />
        <Tooltip
          formatter={(v) => [`${v}%`, 'Utilization']}
          contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
        />
        <Line
          type="monotone"
          dataKey="util"
          stroke="#1B2B6B"
          strokeWidth={2.5}
          dot={{ r: 3, fill: '#1B2B6B' }}
          activeDot={{ r: 5, fill: '#39B54A' }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

interface DowChartProps {
  data: { day: string; office: number; remote: number; other: number }[]
}

export function DowChart({ data }: DowChartProps) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }} barGap={2}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
        <XAxis
          dataKey="day"
          tick={{ fontSize: 11, fontFamily: 'DM Sans, sans-serif' }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tick={{ fontSize: 10, fontFamily: 'DM Mono, monospace' }}
          tickLine={false}
          axisLine={false}
          width={28}
        />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
        />
        <Legend
          wrapperStyle={{ fontSize: 11, fontFamily: 'DM Sans, sans-serif' }}
          iconSize={10}
        />
        <Bar dataKey="office" name="Office"         fill="#39B54A" radius={[3, 3, 0, 0]} maxBarSize={24} />
        <Bar dataKey="other"  name="Other location" fill="#F7941D" radius={[3, 3, 0, 0]} maxBarSize={24} />
        <Bar dataKey="remote" name="Remote"         fill="#29ABE2" radius={[3, 3, 0, 0]} maxBarSize={24} />
      </BarChart>
    </ResponsiveContainer>
  )
}
