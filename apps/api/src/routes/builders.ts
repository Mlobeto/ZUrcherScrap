import { Router } from 'express';
import { prisma } from '../lib/prisma.js';

export const buildersRouter = Router();

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
