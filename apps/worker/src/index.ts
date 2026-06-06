import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../.env') });
import { PrismaClient } from '@prisma/client';
import { scrapeLeeAccelaPermits } from './adapters/lee-accela.js';
import { ingestPermits } from './pipeline/ingest.js';

const prisma = new PrismaClient();

async function main() {
  const lookbackDays = Number(process.argv[2]) || Number(process.env.SCRAPE_LOOKBACK_DAYS) || 30;

  console.log(`Starting Lee County Accela scrape (last ${lookbackDays} days)...`);

  const scrapeRun = await prisma.scrapeRun.create({
    data: {
      county: 'lee',
      sourceType: 'accela_permits',
      status: 'running',
    },
  });

  try {
    const permits = await scrapeLeeAccelaPermits(lookbackDays);
    const ingested = await ingestPermits(prisma, permits, scrapeRun.id);

    await prisma.scrapeRun.update({
      where: { id: scrapeRun.id },
      data: {
        status: 'completed',
        finishedAt: new Date(),
        recordsFound: ingested,
      },
    });

    console.log(`Done. Ingested ${ingested} permits.`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.scrapeRun.update({
      where: { id: scrapeRun.id },
      data: {
        status: 'failed',
        finishedAt: new Date(),
        error: message,
      },
    });
    console.error('Scrape failed:', message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
