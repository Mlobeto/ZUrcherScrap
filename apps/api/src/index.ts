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

// CORS_ORIGIN can be a comma-separated list of allowed origins, e.g.
// "https://your-app.vercel.app,https://your-custom-domain.com"
// Leave unset (or set to "*") to allow all origins during development.
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
  : '*';

app.use(cors({ origin: allowedOrigins }));
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
