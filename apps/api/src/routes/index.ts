import { Router } from 'express';
import { adminRouter } from '../admin/routes.js';
import { catalogRouter } from './catalog.js';
import { healthRouter } from './health.js';
import { ordersRouter } from './orders.js';
import { homeAdsRouter } from './home-ads.js';
import { packagesRouter } from './packages.js';

export const apiRouter = Router();

apiRouter.use(healthRouter);
apiRouter.use('/catalog', catalogRouter);
apiRouter.use('/orders', ordersRouter);
apiRouter.use('/packages', packagesRouter);
apiRouter.use('/home-ads', homeAdsRouter);
apiRouter.use('/admin', adminRouter);
