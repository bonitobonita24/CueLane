// Wave 7.7a-T3 — Premium-only hourly-traffic bar chart. shadcn `chart` (Recharts) wrapper, tokens
// only (--chart-1, no hardcoded hex — see packages/ui globals.css). `useReducedMotion` isn't wired
// here — Recharts' own `isAnimationActive` is set false when the OS `prefers-reduced-motion` media
// query matches (checked once per mount), matching R13/R14's "no motion for reduced-motion users"
// gate without introducing a new animation-library dependency for a single static bar entrance.
'use client';

import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, XAxis } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@cuelane/ui/chart';

interface HourlyTrafficChartProps {
  data: { hour: number; count: number }[];
}

const chartConfig = {
  count: { label: 'Tickets', color: 'hsl(var(--chart-1))' },
} satisfies ChartConfig;

export function HourlyTrafficChart({ data }: HourlyTrafficChartProps) {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mql.matches);
    const onChange = () => setReducedMotion(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  const formatted = data.map((d) => ({ ...d, label: String(d.hour).padStart(2, '0') }));

  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-64 w-full">
      <BarChart data={formatted}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} interval={2} fontSize={11} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar
          dataKey="count"
          fill="var(--color-count)"
          radius={4}
          isAnimationActive={!reducedMotion}
        />
      </BarChart>
    </ChartContainer>
  );
}
