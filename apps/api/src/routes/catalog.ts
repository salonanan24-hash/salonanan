import { Router } from 'express';
import { readCatalog } from '../admin/catalog.js';
import { wrap } from '../admin/wrap.js';
import { toStorefront } from '../catalog/storefront.js';

export const catalogRouter = Router();

catalogRouter.get(
  '/',
  wrap(async (_req, res) => {
    res.json(toStorefront(await readCatalog()));
  }),
);
