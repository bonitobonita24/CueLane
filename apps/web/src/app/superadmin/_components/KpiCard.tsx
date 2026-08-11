// Wave 7.8-T3 — Super Admin KPI card. Same dumb-presentational contract as [tenant]/admin's
// KpiCard.tsx — duplicated locally rather than cross-route-group imported (route groups under
// app/ are meant to stay self-contained; this is a 12-line component).
import { Card, CardContent, CardHeader, CardTitle } from '@cuelane/ui';

interface KpiCardProps {
  label: string;
  value: string;
}

export function KpiCard({ label, value }: KpiCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}
