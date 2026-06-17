import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../.env') });
import { PrismaClient } from '@prisma/client';
import { scrapeAccelaPermits, LEE_CONFIG, CHARLOTTE_CONFIG, SARASOTA_CONFIG, HILLSBOROUGH_CONFIG, type AccelaConfig } from './adapters/accela.js';
import { ingestPermits } from './pipeline/ingest.js';

const prisma = new PrismaClient();

async function scrapeCounty(config: AccelaConfig, lookbackDays: number) {
  console.log(`\nStarting ${config.county.toUpperCase()} County Accela scrape (last ${lookbackDays} days)...`);

  const scrapeRun = await prisma.scrapeRun.create({
    data: { county: config.county, sourceType: 'accela_permits', status: 'running' },
  });

  try {
    const permits = await scrapeAccelaPermits(config, lookbackDays);
    const ingested = await ingestPermits(prisma, permits, scrapeRun.id);

    await prisma.scrapeRun.update({
      where: { id: scrapeRun.id },
      data: { status: 'completed', finishedAt: new Date(), recordsFound: ingested },
    });

    console.log(`[${config.county}] Done. Ingested ${ingested} permits.`);
    return ingested;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.scrapeRun.update({
      where: { id: scrapeRun.id },
      data: { status: 'failed', finishedAt: new Date(), error: message },
    });
    console.error(`[${config.county}] Scrape failed:`, message);
    return 0;
  }
}

async function main() {
  const lookbackDays = Number(process.argv[2]) || Number(process.env.SCRAPE_LOOKBACK_DAYS) || 30;

  // SCRAPE_COUNTIES env var controls which counties to scrape (comma-separated)
  // e.g. SCRAPE_COUNTIES=lee,charlotte  or  SCRAPE_COUNTIES=charlotte
  // Default: all counties
  const allowed = process.env.SCRAPE_COUNTIES
    ? process.env.SCRAPE_COUNTIES.split(',').map((s) => s.trim().toLowerCase())
    : null;

  const all = [LEE_CONFIG, CHARLOTTE_CONFIG, SARASOTA_CONFIG, HILLSBOROUGH_CONFIG];
  const counties = allowed ? all.filter((c) => allowed.includes(c.county)) : all;
  let total = 0;

  for (const config of counties) {
    total += await scrapeCounty(config, lookbackDays);
  }

  await prisma.$disconnect();
  console.log(`\nAll done. Total ingested: ${total} permits.`);
}

main();
