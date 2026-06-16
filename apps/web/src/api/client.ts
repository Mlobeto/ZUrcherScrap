export interface Permit {
  id: string;
  county: string;
  permitNumber: string;
  permitType: string;
  address: string | null;
  city: string | null;
  builderName: string | null;
  estimatedValue: number | null;
  recordStatus: string | null;
  requiresSeptic: boolean;
  serviceZone: 'lehigh_core' | 'service_area' | 'out_of_area' | 'unknown';
  sourceUrl: string;
  permitDate: string | null;
}

export interface Builder {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  projectsDetected: number;
}

export interface Opportunity {
  id: string;
  score: number;
  status: string;
  permit: Permit;
  builder: Builder | null;
}

// In production set VITE_API_URL=https://your-api.onrender.com
// In dev the Vite proxy handles /api → localhost:3001 so this stays empty
const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '';

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json() as Promise<T>;
}

export function getOpportunities(params: Record<string, string>) {
  const qs = new URLSearchParams(params).toString();
  return fetchJson<{ data: Opportunity[] }>(`/api/opportunities?${qs}`);
}

export function getBuilders() {
  return fetchJson<{ data: Builder[] }>('/api/builders?limit=100');
}

export function triggerScrape(lookbackDays = 30) {
  return fetch(`${API_BASE}/api/scrape/trigger`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lookbackDays }),
  });
}

export async function downloadMissingBuildersExcel() {
  const res = await fetch(`${API_BASE}/api/builders/export/missing`);
  if (!res.ok) throw new Error(`Export failed (${res.status})`);

  const blob = await res.blob();
  const disposition = res.headers.get('Content-Disposition') ?? '';
  const match = disposition.match(/filename="?([^"]+)"?/);
  const filename = match?.[1] ?? `constructoras-sin-contacto-${new Date().toISOString().slice(0, 10)}.csv`;

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
