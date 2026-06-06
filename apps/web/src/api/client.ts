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

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(path);
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
  return fetch('/api/scrape/trigger', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lookbackDays }),
  });
}
