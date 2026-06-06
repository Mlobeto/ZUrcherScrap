import { Router } from 'express';
import { prisma } from '../lib/prisma.js';

export const permitsRouter = Router();

permitsRouter.get('/', async (req, res) => {
  const county = req.query.county as string | undefined;
  const from = req.query.from as string | undefined;
  const to = req.query.to as string | undefined;
  const limit = Math.min(Number(req.query.limit) || 50, 200);

  const permits = await prisma.permit.findMany({
    where: {
      ...(county ? { county } : {}),
      ...(from || to
        ? {
            permitDate: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(to) } : {}),
            },
          }
        : {}),
    },
    orderBy: { permitDate: 'desc' },
    take: limit,
  });

  res.json({ data: permits, total: permits.length });
});

permitsRouter.get('/:id', async (req, res) => {
  const permit = await prisma.permit.findUnique({
    where: { id: req.params.id },
    include: { opportunities: { include: { builder: true } } },
  });

  if (!permit) {
    res.status(404).json({ error: 'Permit not found' });
    return;
  }

  res.json(permit);
});
