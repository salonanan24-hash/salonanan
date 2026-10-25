import { Router } from 'express';
import { AppError } from '../errors/app-error.js';
import { wrap } from '../admin/wrap.js';
import { listOrdersForUser, listShippingZones, optionalUser, orderForUser, placeOrder, placeSchema, quoteOrder, quoteSchema } from '../orders/orders.js';

export const ordersRouter = Router();

ordersRouter.post(
  '/quote',
  wrap(async (req, res) => {
    res.json(await quoteOrder(quoteSchema.parse(req.body)));
  }),
);

ordersRouter.post(
  '/',
  wrap(async (req, res) => {
    const input = placeSchema.parse(req.body);
    const user = await optionalUser(req);
    const order = await placeOrder(input, user?.id ?? null);
    res.status(201).json({ order });
  }),
);

ordersRouter.get(
  '/shipping-zones',
  wrap(async (_req, res) => {
    res.json({ zones: await listShippingZones() });
  }),
);

ordersRouter.get(
  '/',
  wrap(async (req, res) => {
    const user = await optionalUser(req);
    if (!user) throw new AppError(401, 'unauthorized', 'Sign in required');
    res.json({ orders: await listOrdersForUser(user.id, user.email ?? '') });
  }),
);

ordersRouter.get(
  '/:id',
  wrap(async (req, res) => {
    const user = await optionalUser(req);
    if (!user) throw new AppError(401, 'unauthorized', 'Sign in required');
    res.json({ order: await orderForUser(String(req.params.id), user.id, user.email ?? '') });
  }),
);
