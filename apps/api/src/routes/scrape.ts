import { Router } from 'express';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { prisma } from '../lib/prisma.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workerDir = path.resolve(__dirname, '../../../worker');

export const scrapeRouter = Router();

let scrapeInProgress = false;

scrapeRouter.get('/runs', async (_req, res) => {
  const runs = await prisma.scrapeRun.findMany({
    orderBy: { startedAt: 'desc' },
    take: 20,
  });
  res.json({ data: runs });
});

scrapeRouter.post('/trigger', async (req, res) => {
  if (scrapeInProgress) {
    res.status(409).json({ error: 'Scrape already in progress' });
    return;
  }

  const lookbackDays = Number(req.body?.lookbackDays) || Number(process.env.SCRAPE_LOOKBACK_DAYS) || 30;
  scrapeInProgress = true;

  const child = spawn('npm', ['run', 'scrape', '-w', '@scrapzurcher/worker', '--', String(lookbackDays)], {
    cwd: path.resolve(workerDir, '../..'),
    shell: true,
    stdio: 'inherit',
    env: process.env,
  });

  child.on('close', (code) => {
    scrapeInProgress = false;
    console.log(`Scrape finished with code ${code}`);
  });

  res.status(202).json({ message: 'Scrape started', lookbackDays });
});
