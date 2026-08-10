// Wave 7.8-T3 — platform-wide "tenants by tier" bar chart. Mirrors [tenant]/admin's
// HourlyTrafficChart.tsx pattern exactly (shadcn `chart`/Recharts wrapper via the dedicated
// `@cuelane/ui/chart` subpath — never the barrel, see packages/ui/src/index.ts's note — +
// `prefers-reduced-motion` gate via Recharts' own `isAnimationActive`).
'use client';

import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, XAxis } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@cuelane/ui/chart';

interface TenantsByTierChartProps {
  data: { tier: string; count: number }[];
}

const chartConfig = {
  count: { label: 'Tenants', color: 'hsl(var(--chart-1))' },
} satisfies ChartConfig;

export function TenantsByTierChart({ data }: TenantsByTierChartProps) {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mql.matches);
    const onChange = () => setReducedMotion(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-64 w-full">
      <BarChart data={data}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="tier" tickLine={false} axisLine={false} fontSize={12} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="count" fill="var(--color-count)" radius={4} isAnimationActive={!reducedMotion} />
      </BarChart>
    </ChartContainer>
  );
}
