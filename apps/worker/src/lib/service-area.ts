export type ServiceZone = 'lehigh_core' | 'service_area' | 'out_of_area' | 'unknown';

/** Condados dentro del radio ~200 km desde Lehigh Acres */
export const SERVICE_COUNTIES = [
  'lee',
  'charlotte',
  'collier',
  'sarasota',
  'hendry',
  'glades',
  'desoto',
] as const;

const CORE_CITY_PATTERNS = [/lehigh\s*acres/i, /\blehigh\b/i];

const PERMIT_OFFICE_PATTERNS = [
  /1500\s+monroe/i,
  /permit\s+center/i,
  /community\s+development/i,
];

const SEPTIC_PATTERNS = [
  /septic/i,
  /health\s*dept/i,
  /drain\s*field/i,
  /drainfield/i,
  /onsite\s*sewage/i,
  /sewage\s*treatment/i,
  /wastewater\s*treatment/i,
];

export function detectRequiresSeptic(text: string): boolean {
  return SEPTIC_PATTERNS.some((p) => p.test(text));
}

export function isPermitOfficeAddress(text: string | null): boolean {
  if (!text) return false;
  return PERMIT_OFFICE_PATTERNS.some((p) => p.test(text));
}

export function classifyServiceZone(
  city: string | null,
  address: string | null,
  county: string
): ServiceZone {
  const locationText = `${city ?? ''} ${address ?? ''}`;

  if (CORE_CITY_PATTERNS.some((p) => p.test(locationText))) {
    return 'lehigh_core';
  }

  const countyNorm = county.toLowerCase();
  if (SERVICE_COUNTIES.includes(countyNorm as (typeof SERVICE_COUNTIES)[number])) {
    return 'service_area';
  }

  if (countyNorm === 'lee') {
    return 'service_area';
  }

  return 'out_of_area';
}

export function parseLocationFromText(text: string | null): {
  address: string | null;
  city: string | null;
} {
  if (!text) return { address: null, city: null };

  const match = text.match(
    /(\d+[^\n,]*?(?:AVE|ST|DR|RD|BLVD|LN|CT|WAY|PL|CIR)[^\n,]*)\s+([A-Z][A-Z\s]+?)\s+FL\s*(\d{5})?/i
  );

  if (match) {
    return {
      address: match[1].trim(),
      city: match[2].trim(),
    };
  }

  return { address: null, city: null };
}
