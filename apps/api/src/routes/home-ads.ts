import { Router } from 'express';
import { wrap } from '../admin/wrap.js';
import { listHomeAds } from '../home-ads/home-ads.js';

export const homeAdsRouter = Router();

homeAdsRouter.get(
  '/',
  wrap(async (_req, res) => {
    res.json({ ads: await listHomeAds() });
  }),
);
