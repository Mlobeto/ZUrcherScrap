import { Prisma, PrismaClient } from '@prisma/client';
import type { PermitDetail } from '../adapters/lee-accela.js';
import { normalizeBuilderKey } from '../lib/normalize.js';
import { calculateScore } from '../lib/score.js';
import { createHash } from 'node:crypto';

const COUNTY = 'lee';
const SOURCE_TYPE = 'accela_permits';

export async function ingestPermits(prisma: PrismaClient, permits: PermitDetail[], scrapeRunId: string) {
  let count = 0;

  for (const permit of permits) {
    const contentHash = createHash('sha256').update(JSON.stringify(permit)).digest('hex');

    await prisma.rawRecord.create({
      data: {
        scrapeRunId,
        externalId: permit.permitNumber,
        payload: permit as unknown as Prisma.InputJsonValue,
        contentHash,
      },
    });

    const savedPermit = await prisma.permit.upsert({
      where: {
        county_permitNumber: { county: COUNTY, permitNumber: permit.permitNumber },
      },
      create: {
        county: COUNTY,
        sourceType: SOURCE_TYPE,
        permitNumber: permit.permitNumber,
        permitType: permit.permitType,
        address: permit.address,
        city: permit.city,
        state: permit.state,
        ownerName: permit.ownerName,
        builderName: permit.builderName,
        contractorName: permit.contractorName,
        estimatedValue: permit.estimatedValue,
        recordStatus: permit.recordStatus,
        requiresSeptic: permit.requiresSeptic,
        serviceZone: permit.serviceZone,
        sourceUrl: permit.sourceUrl,
        rawData: permit.rawData as Prisma.InputJsonValue,
      },
      update: {
        permitType: permit.permitType,
        address: permit.address,
        city: permit.city,
        ownerName: permit.ownerName,
        builderName: permit.builderName,
        contractorName: permit.contractorName,
        estimatedValue: permit.estimatedValue,
        recordStatus: permit.recordStatus,
        requiresSeptic: permit.requiresSeptic,
        serviceZone: permit.serviceZone,
        sourceUrl: permit.sourceUrl,
        rawData: permit.rawData as Prisma.InputJsonValue,
      },
    });

    let builderId: string | null = null;

    if (permit.builderName && !/owner[\s-]?builder/i.test(permit.builderName)) {
      const normalizedKey = normalizeBuilderKey(permit.builderName);

      const builder = await prisma.builder.upsert({
        where: { normalizedKey },
        create: {
          name: permit.builderName,
          normalizedKey,
          phone: permit.phone,
          email: permit.email,
          projectsDetected: 1,
          lastCheckedAt: new Date(),
        },
        update: {
          phone: permit.phone ?? undefined,
          email: permit.email ?? undefined,
          lastCheckedAt: new Date(),
        },
      });

      const projectCount = await prisma.permit.count({
        where: { builderName: { contains: permit.builderName, mode: 'insensitive' } },
      });

      await prisma.builder.update({
        where: { id: builder.id },
        data: { projectsDetected: projectCount },
      });

      builderId = builder.id;
    }

    const score = calculateScore({
      permitType: permit.permitType,
      builderName: permit.builderName,
      phone: permit.phone,
      email: permit.email,
      estimatedValue: permit.estimatedValue,
      requiresSeptic: permit.requiresSeptic,
      serviceZone: permit.serviceZone,
    });

    await prisma.opportunity.upsert({
      where: { permitId: savedPermit.id },
      create: {
        permitId: savedPermit.id,
        builderId,
        score,
        status: 'new',
      },
      update: {
        builderId,
        score,
      },
    });

    count++;
  }

  return count;
}
