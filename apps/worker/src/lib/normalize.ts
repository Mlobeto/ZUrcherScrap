export function normalizeBuilderKey(name: string): string {
  return name
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseAddressParts(fullAddress: string | null): {
  address: string | null;
  city: string | null;
  state: string;
} {
  if (!fullAddress) return { address: null, city: null, state: 'FL' };

  const match = fullAddress.match(/^(.+?)\s+([A-Z\s]+)\s+FL\s*(\d{5})?/i);
  if (match) {
    return {
      address: match[1].trim(),
      city: match[2].trim(),
      state: 'FL',
    };
  }

  return { address: fullAddress.trim(), city: null, state: 'FL' };
}

export function parseEstimatedValue(raw: string | null): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[^0-9.]/g, '');
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}
