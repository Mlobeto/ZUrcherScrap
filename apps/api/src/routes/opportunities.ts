import { Router } from 'express';
import { prisma } from '../lib/prisma.js';

export const opportunitiesRouter = Router();

opportunitiesRouter.get('/', async (req, res) => {
  const county = req.query.county as string | undefined;
  const from = req.query.from as string | undefined;
  const to = req.query.to as string | undefined;
  const minScore = req.query.minScore ? Number(req.query.minScore) : undefined;
  const status = req.query.status as string | undefined;
  const serviceZone = req.query.serviceZone as string | undefined;
  const requiresSeptic = req.query.requiresSeptic as string | undefined;
  const city = req.query.city as string | undefined;
  const limit = Math.min(Number(req.query.limit) || 50, 200);

  const opportunities = await prisma.opportunity.findMany({
    where: {
      ...(minScore !== undefined ? { score: { gte: minScore } } : {}),
      ...(status ? { status: status as 'new' | 'reviewed' | 'dismissed' } : {}),
      permit: {
        ...(county ? { county } : {}),
        ...(serviceZone
          ? { serviceZone: serviceZone as 'lehigh_core' | 'service_area' | 'out_of_area' | 'unknown' }
          : {}),
        ...(requiresSeptic === 'true' ? { requiresSeptic: true } : {}),
        ...(requiresSeptic === 'false' ? { requiresSeptic: false } : {}),
        ...(city ? { city: { contains: city, mode: 'insensitive' as const } } : {}),
        ...(from || to
          ? {
              permitDate: {
                ...(from ? { gte: new Date(from) } : {}),
                ...(to ? { lte: new Date(to) } : {}),
              },
            }
          : {}),
      },
    },
    include: {
      permit: true,
      builder: true,
    },
    orderBy: [{ score: 'desc' }, { createdAt: 'desc' }],
    take: limit,
  });

  res.json({ data: opportunities, total: opportunities.length });
});

opportunitiesRouter.get('/:id', async (req, res) => {
  const opportunity = await prisma.opportunity.findUnique({
    where: { id: req.params.id },
    include: { permit: true, builder: true },
  });

  if (!opportunity) {
    res.status(404).json({ error: 'Opportunity not found' });
    return;
  }

  res.json(opportunity);
});
