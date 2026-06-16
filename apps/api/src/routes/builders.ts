import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { toCsvRow } from '../lib/csv.js';

export const buildersRouter = Router();

function missingContactLabel(phone: string | null, email: string | null): string {
  const lacksPhone = !phone?.trim();
  const lacksEmail = !email?.trim();
  if (lacksPhone && lacksEmail) return 'Teléfono y email';
  if (lacksPhone) return 'Teléfono';
  if (lacksEmail) return 'Email';
  return '';
}

buildersRouter.get('/export/missing', async (_req, res) => {
  const builders = await prisma.builder.findMany({
    orderBy: { projectsDetected: 'desc' },
    include: {
      opportunities: {
        take: 1,
        orderBy: { createdAt: 'desc' },
        include: { permit: true },
      },
    },
  });

  const missing = builders.filter((b) => !b.phone?.trim() || !b.email?.trim());

  const header = toCsvRow([
    'Constructora',
    'Teléfono',
    'Email',
    'Dirección comercial',
    'Obras detectadas',
    'Falta contacto',
    'Último permiso',
    'Ciudad obra',
    'Dirección obra',
    'URL permiso',
    'Detectado',
  ]);

  const rows = missing.map((b) => {
    const lastPermit = b.opportunities[0]?.permit;
    return toCsvRow([
      b.name,
      b.phone,
      b.email,
      b.address,
      b.projectsDetected,
      missingContactLabel(b.phone, b.email),
      lastPermit?.permitNumber ?? '',
      lastPermit?.city ?? '',
      lastPermit?.address ?? '',
      lastPermit?.sourceUrl ?? '',
      b.createdAt.toISOString().slice(0, 10),
    ]);
  });

  const csv = `\uFEFF${[header, ...rows].join('\r\n')}`;
  const date = new Date().toISOString().slice(0, 10);

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="constructoras-sin-contacto-${date}.csv"`);
  res.send(csv);
});

buildersRouter.get('/', async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 200);

  const builders = await prisma.builder.findMany({
    orderBy: { projectsDetected: 'desc' },
    take: limit,
    include: {
      opportunities: {
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { permit: true },
      },
    },
  });

  res.json({ data: builders, total: builders.length });
});

buildersRouter.get('/:id', async (req, res) => {
  const builder = await prisma.builder.findUnique({
    where: { id: req.params.id },
    include: {
      opportunities: {
        orderBy: { createdAt: 'desc' },
        include: { permit: true },
      },
    },
  });

  if (!builder) {
    res.status(404).json({ error: 'Builder not found' });
    return;
  }

  res.json(builder);
});
