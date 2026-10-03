'use client'

import { useTheme } from 'next-themes'
import {
  AreaChart, Area, BarChart, Bar,
  CartesianGrid, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts'

// Series colours validated for colour-blind separation and contrast on each surface
const PALETTE = {
  light: { office: '#2E9E44', other: '#C2187A', remote: '#1C8FC4', line: '#1C8FC4', grid: 'rgba(16,24,64,0.07)', axis: '#5D6784', ref: '#D97706', surface: '#FFFFFF' },
  dark:  { office: '#36AB55', other: '#DE55A6', remote: '#2A99CF', line: '#5CC8F2', grid: 'rgba(148,163,220,0.10)', axis: '#8C95B5', ref: '#F5A524', surface: '#0E1430' },
}

// Charts only draw on the client (ResponsiveContainer measures first), so reading the theme here is hydration-safe
function usePalette() {
  const { resolvedTheme } = useTheme()
  return PALETTE[resolvedTheme === 'dark' ? 'dark' : 'light']
}

// Legend swatches use the matching CSS tokens so server and client markup agree
const SERIES_LEGEND = [
  { label: 'Office', color: 'var(--office)' },
  { label: 'Other site', color: 'var(--other)' },
  { label: 'Remote', color: 'var(--remote)' },
]

const AXIS = { fontSize: 11, fontFamily: 'var(--font-dm-mono), monospace' }

function ChartTooltip({ active, payload, label, unit = '', names }: {
  active?: boolean
  payload?: { dataKey?: string | number; value?: number; color?: string }[]
  label?: string
  unit?: string
  names?: Record<string, string>
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="panel bg-[var(--panel-solid)] px-3 py-2 text-[12px] shadow-lg">
      <div className="font-semibold text-ink mb-1">{label}</div>
      {payload.map(p => (
        <div key={String(p.dataKey)} className="flex items-center gap-2 text-ink-2">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ background: p.color }} />
          <span className="flex-1">{names?.[String(p.dataKey)] ?? String(p.dataKey)}</span>
          <span className="font-mono tabular-nums text-ink">{p.value}{unit}</span>
        </div>
      ))}
    </div>
  )
}

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-ink-2">
      {items.map(i => (
        <li key={i.label} className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ background: i.color }} />{i.label}
        </li>
      ))}
    </ul>
  )
}

interface WeeklyChartProps {
  data: { label: string; util: number }[]
}

export function WeeklyUtilChart({ data }: WeeklyChartProps) {
  const c = usePalette()
  const top = Math.ceil(Math.max(100, ...data.map(d => d.util)) / 25) * 25
  const ticks = Array.from({ length: top / 25 + 1 }, (_, i) => i * 25)
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 12, right: 12, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="utilFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={c.line} stopOpacity={0.35} />
            <stop offset="100%" stopColor={c.line} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke={c.grid} />
        <XAxis dataKey="label" tick={{ ...AXIS, fill: c.axis }} interval="preserveStartEnd" tickLine={false} axisLine={false} dy={6} />
        <YAxis domain={[0, top]} ticks={ticks} tickFormatter={v => `${v}%`} tick={{ ...AXIS, fill: c.axis }} tickLine={false} axisLine={false} width={42} />
        <ReferenceLine y={100} stroke={c.ref} strokeDasharray="4 4" label={{ value: 'Capacity', position: 'insideTopRight', fill: c.axis, fontSize: 11 }} />
        <Tooltip content={<ChartTooltip unit="%" names={{ util: 'Utilization' }} />} cursor={{ stroke: c.axis, strokeDasharray: '3 3' }} />
        <Area
          type="monotone" dataKey="util" stroke={c.line} strokeWidth={2} fill="url(#utilFill)"
          dot={{ r: 3, fill: c.surface, stroke: c.line, strokeWidth: 2 }}
          activeDot={{ r: 5, fill: c.line, stroke: c.surface, strokeWidth: 2 }}
          animationDuration={500}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

interface DowChartProps {
  data: { day: string; office: number; remote: number; other: number }[]
}

export function DowChart({ data }: DowChartProps) {
  const c = usePalette()
  return (
    <>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 12, right: 12, bottom: 0, left: 0 }} barGap={2} barCategoryGap="22%">
          <CartesianGrid vertical={false} stroke={c.grid} />
          <XAxis dataKey="day" tick={{ ...AXIS, fill: c.axis }} tickLine={false} axisLine={false} dy={6} />
          <YAxis tick={{ ...AXIS, fill: c.axis }} tickLine={false} axisLine={false} width={30} allowDecimals={false} />
          <Tooltip content={<ChartTooltip names={{ office: 'Office', other: 'Other site', remote: 'Remote' }} />} cursor={{ fill: c.grid }} />
          <Bar dataKey="office" fill={c.office} radius={[4, 4, 0, 0]} maxBarSize={22} animationDuration={500} />
          <Bar dataKey="other"  fill={c.other}  radius={[4, 4, 0, 0]} maxBarSize={22} animationDuration={500} />
          <Bar dataKey="remote" fill={c.remote} radius={[4, 4, 0, 0]} maxBarSize={22} animationDuration={500} />
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-2"><Legend items={SERIES_LEGEND} /></div>
    </>
  )
}

interface GroupChartProps {
  data: { name: string; color: string; office: number; other: number; remote: number }[]
}

/** Average days per person per week, by group (stacked so groups compare at a glance). */
export function GroupChart({ data }: GroupChartProps) {
  const c = usePalette()
  return (
    <>
      <ResponsiveContainer width="100%" height={Math.max(120, data.length * 44 + 20)}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 0 }} barCategoryGap="28%">
          <CartesianGrid horizontal={false} stroke={c.grid} />
          <XAxis type="number" domain={[0, 5]} ticks={[0, 1, 2, 3, 4, 5]} tick={{ ...AXIS, fill: c.axis }} tickLine={false} axisLine={false} />
          <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 12, fill: c.axis }} tickLine={false} axisLine={false} />
          <Tooltip content={<ChartTooltip names={{ office: 'Office', other: 'Other site', remote: 'Remote' }} />} cursor={{ fill: c.grid }} />
          <Bar dataKey="office" stackId="a" fill={c.office} stroke={c.surface} strokeWidth={2} animationDuration={500} />
          <Bar dataKey="other"  stackId="a" fill={c.other}  stroke={c.surface} strokeWidth={2} animationDuration={500} />
          <Bar dataKey="remote" stackId="a" fill={c.remote} stroke={c.surface} strokeWidth={2} radius={[0, 4, 4, 0]} animationDuration={500} />
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-2"><Legend items={SERIES_LEGEND} /></div>
    </>
  )
}
