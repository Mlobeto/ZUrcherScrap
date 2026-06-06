import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../.env') });
import cors from 'cors';
import express from 'express';
import { permitsRouter } from './routes/permits.js';
import { buildersRouter } from './routes/builders.js';
import { opportunitiesRouter } from './routes/opportunities.js';
import { scrapeRouter } from './routes/scrape.js';

const app = express();
const port = Number(process.env.PORT) || 3001;

app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'scrapzurcher-api' });
});

app.use('/api/permits', permitsRouter);
app.use('/api/builders', buildersRouter);
app.use('/api/opportunities', opportunitiesRouter);
app.use('/api/scrape', scrapeRouter);

app.listen(port, () => {
  console.log(`API running at http://localhost:${port}`);
});
