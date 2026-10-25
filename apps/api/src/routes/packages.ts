import { Router } from 'express';
import { wrap } from '../admin/wrap.js';
import { listPackages } from '../packages/packages.js';

export const packagesRouter = Router();

packagesRouter.get(
  '/',
  wrap(async (_req, res) => {
    const packages = await listPackages(true);
    res.json({
      packages: packages.map((item) => ({
        id: item.id,
        name: { he: item.nameHe, ar: item.nameAr },
        priceMinor: item.priceMinor,
        productIds: item.productIds,
      })),
    });
  }),
);
