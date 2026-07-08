// Utils
export { cn } from './lib/utils';

// Components
export * from './components/ui/button';
export * from './components/ui/card';
export * from './components/ui/input';
export * from './components/ui/label';
export * from './components/ui/select';
export * from './components/ui/dialog';
export * from './components/ui/badge';
export * from './components/ui/table';
export * from './components/ui/sonner';
// NOTE: form.tsx is intentionally NOT re-exported here — react-hook-form ships a "react-server"
// export condition, and re-exporting it from this barrel breaks any Server Component that imports
// ANYTHING from '@cuelane/ui' (webpack resolves react-hook-form's reduced react-server build for
// the whole module graph reached from an RSC entry, even inside form.tsx's own 'use client'
// boundary, dropping FormProvider/Controller/useFormContext). Import Form* from the dedicated
// '@cuelane/ui/form' subpath instead (same pattern as '@cuelane/ui/toaster').
export * from './components/ui/tabs';
export * from './components/ui/switch';
export * from './components/ui/textarea';
export * from './components/ui/progress';
export * from './components/ui/alert-dialog';
export * from './components/ui/dropdown-menu';
export * from './components/ui/separator';
export * from './components/ui/checkbox';
export * from './components/ui/skeleton';
// NOTE: chart.tsx and toggle-group.tsx/toggle.tsx are intentionally NOT re-exported here — same
// reasoning as form.tsx above. Wave 7.7a-T3 root-caused this exact failure mode: adding
// `@radix-ui/react-toggle-group` (ToggleGroup, for the Dashboard's daily/monthly/yearly range
// toggle) to this barrel broke the PRODUCTION BUILD of an unrelated Server Component (/login,
// which never imports ToggleGroup — it only imports Card from '@cuelane/ui') with
// "TypeError: e.createContext is not a function" during Next's "Collecting page data" step.
// Bisected empirically (stub-swap each new component in turn): toggle-group.tsx was the
// reproducible culprit; chart.tsx (recharts) tested clean via its OWN subpath but is kept off the
// barrel too as the same defensive pattern (its client-only dep profile matches the class of
// libs that trip this). Import ToggleGroup*/Chart* from '@cuelane/ui/toggle-group' /
// '@cuelane/ui/chart' instead — never re-export a client-only heavy-dep component from this
// barrel; give it its own package.json `exports` subpath. toggle.tsx (the single Toggle, not
// ToggleGroup) is kept off the barrel too since it's toggle-group.tsx's own dependency and
// wasn't isolated separately — same subpath (`@cuelane/ui/toggle-group` re-exports both).
