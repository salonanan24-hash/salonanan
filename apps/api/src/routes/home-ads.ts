import { Router } from 'express';
import { z } from 'zod';
import { wrap } from '../admin/wrap.js';
import { listHomeAds } from '../home-ads/home-ads.js';

export const homeAdsRouter = Router();

homeAdsRouter.get(
  '/',
  wrap(async (req, res) => {
    const placement = z.enum(['hero', 'square', 'section', 'packages']).catch('hero').parse(req.query.placement);
    res.json({ ads: await listHomeAds(placement) });
  }),
);
