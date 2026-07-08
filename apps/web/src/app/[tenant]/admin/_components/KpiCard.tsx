// Wave 7.7a-T3 — Dashboard KPI card. Dumb presentational component: label + formatted value, one
// per KPI in the 8-card row. No entity-specific logic — dashboard-client.tsx formats the value.
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
