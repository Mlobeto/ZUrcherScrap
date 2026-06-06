import type { ServiceZone } from './service-area.js';

export interface ScoreInput {
  permitType: string;
  builderName: string | null;
  phone: string | null;
  email: string | null;
  estimatedValue: number | null;
  requiresSeptic: boolean;
  serviceZone: ServiceZone;
}

export function calculateScore(input: ScoreInput): number {
  let score = 0;

  if (input.permitType.toLowerCase().includes('residential new primary structure')) {
    score += 50;
  }

  if (input.builderName && !/owner[\s-]?builder/i.test(input.builderName)) {
    score += 20;
  }

  if (input.phone) score += 10;
  if (input.email) score += 10;

  if (input.estimatedValue && input.estimatedValue >= 100_000) {
    score += 10;
  }

  if (input.requiresSeptic) {
    score += 15;
  }

  if (input.serviceZone === 'lehigh_core') {
    score += 20;
  } else if (input.serviceZone === 'service_area') {
    score += 5;
  }

  return Math.min(score, 100);
}
