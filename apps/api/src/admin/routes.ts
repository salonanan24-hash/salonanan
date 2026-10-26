import { Router } from 'express';
import { z } from 'zod';
import {
  brandInput,
  categoryInput,
  couponInput,
  createBrand,
  createCategory,
  createField,
  createSubcategory,
  deleteBrand,
  deleteCategory,
  deleteCoupon,
  deleteField,
  deleteProduct,
  deleteSubcategory,
  fieldInput,
  idSchema,
  importCatalog,
  isCatalogEmpty,
  subcategoryInput,
  parseCatalog,
  productSchema,
  readCatalog,
  saveCoupon,
  saveProduct,
  settingsInput,
  updateBrand,
  updateCategory,
  updateField,
  updateSubcategory,
  writeSettings,
} from './catalog.js';
import { countRegisteredCustomers, listAllOrders, updateOrderStatus } from '../orders/orders.js';
import { homeAdsInput, replaceHomeAds } from '../home-ads/home-ads.js';
import { deletePackage, listPackages, packageInput, savePackage } from '../packages/packages.js';
import { requireAdmin } from './require-admin.js';
import { wrap } from './wrap.js';

export const adminRouter = Router();

adminRouter.use(wrap(requireAdmin));

adminRouter.get(
  '/orders',
  wrap(async (_req, res) => {
    res.json({ orders: await listAllOrders() });
  }),
);

adminRouter.patch(
  '/orders/:id',
  wrap(async (req, res) => {
    const id = idSchema.parse(req.params.id);
    const status = z.enum(['placed', 'processing', 'ready', 'shipping', 'completed', 'cancelled']).parse(req.body?.status);
    await updateOrderStatus(id, status);
    res.json({ ok: true });
  }),
);

adminRouter.get(
  '/customers/count',
  wrap(async (_req, res) => {
    res.json({ count: await countRegisteredCustomers() });
  }),
);

adminRouter.get(
  '/catalog',
  wrap(async (_req, res) => {
    const empty = await isCatalogEmpty();
    const catalog = empty
      ? {
          categories: [],
          brands: [],
          products: [],
          coupons: [],
          settings: (await readCatalog()).settings,
        }
      : await readCatalog();
    res.json({ empty, catalog });
  }),
);

adminRouter.post(
  '/catalog/import',
  wrap(async (req, res) => {
    const catalog = await importCatalog(parseCatalog(req.body));
    res.json({ catalog });
  }),
);

adminRouter.post(
  '/categories',
  wrap(async (req, res) => {
    await createCategory(categoryInput.parse(req.body));
    res.status(201).json({ ok: true });
  }),
);

adminRouter.patch(
  '/categories/:id',
  wrap(async (req, res) => {
    const id = idSchema.parse(req.params.id);
    const input = categoryInput.omit({ id: true }).parse(req.body);
    await updateCategory(id, input);
    res.json({ ok: true });
  }),
);

adminRouter.delete(
  '/categories/:id',
  wrap(async (req, res) => {
    await deleteCategory(idSchema.parse(req.params.id));
    res.json({ ok: true });
  }),
);

adminRouter.post(
  '/categories/:id/subcategories',
  wrap(async (req, res) => {
    await createSubcategory(idSchema.parse(req.params.id), subcategoryInput.parse(req.body));
    res.status(201).json({ ok: true });
  }),
);

adminRouter.patch(
  '/subcategories/:id',
  wrap(async (req, res) => {
    await updateSubcategory(idSchema.parse(req.params.id), subcategoryInput.omit({ id: true }).parse(req.body));
    res.json({ ok: true });
  }),
);

adminRouter.delete(
  '/subcategories/:id',
  wrap(async (req, res) => {
    await deleteSubcategory(idSchema.parse(req.params.id));
    res.json({ ok: true });
  }),
);

adminRouter.post(
  '/categories/:id/fields',
  wrap(async (req, res) => {
    await createField(idSchema.parse(req.params.id), fieldInput.parse(req.body));
    res.status(201).json({ ok: true });
  }),
);

adminRouter.patch(
  '/fields/:id',
  wrap(async (req, res) => {
    await updateField(idSchema.parse(req.params.id), fieldInput.omit({ id: true }).parse(req.body));
    res.json({ ok: true });
  }),
);

adminRouter.delete(
  '/fields/:id',
  wrap(async (req, res) => {
    await deleteField(idSchema.parse(req.params.id));
    res.json({ ok: true });
  }),
);

adminRouter.post(
  '/brands',
  wrap(async (req, res) => {
    await createBrand(brandInput.parse(req.body));
    res.status(201).json({ ok: true });
  }),
);

adminRouter.patch(
  '/brands/:id',
  wrap(async (req, res) => {
    await updateBrand(idSchema.parse(req.params.id), brandInput.omit({ id: true }).parse(req.body));
    res.json({ ok: true });
  }),
);

adminRouter.delete(
  '/brands/:id',
  wrap(async (req, res) => {
    await deleteBrand(idSchema.parse(req.params.id));
    res.json({ ok: true });
  }),
);

adminRouter.put(
  '/products/:id',
  wrap(async (req, res) => {
    const id = idSchema.parse(req.params.id);
    const product = productSchema.parse({ ...req.body, id });
    await saveProduct(product);
    res.json({ ok: true });
  }),
);

adminRouter.delete(
  '/products/:id',
  wrap(async (req, res) => {
    await deleteProduct(idSchema.parse(req.params.id));
    res.json({ ok: true });
  }),
);

adminRouter.put(
  '/coupons/:id',
  wrap(async (req, res) => {
    const id = idSchema.parse(req.params.id);
    await saveCoupon(couponInput.parse({ ...req.body, id }));
    res.json({ ok: true });
  }),
);

adminRouter.delete(
  '/coupons/:id',
  wrap(async (req, res) => {
    await deleteCoupon(idSchema.parse(req.params.id));
    res.json({ ok: true });
  }),
);

adminRouter.get(
  '/packages',
  wrap(async (_req, res) => {
    res.json({ packages: await listPackages(false) });
  }),
);

adminRouter.put(
  '/packages/:id',
  wrap(async (req, res) => {
    const id = idSchema.parse(req.params.id);
    await savePackage(packageInput.parse({ ...req.body, id }));
    res.json({ ok: true });
  }),
);

adminRouter.delete(
  '/packages/:id',
  wrap(async (req, res) => {
    await deletePackage(idSchema.parse(req.params.id));
    res.json({ ok: true });
  }),
);

adminRouter.put(
  '/home-ads',
  wrap(async (req, res) => {
    await replaceHomeAds(homeAdsInput.parse(req.body).ads);
    res.json({ ok: true });
  }),
);

adminRouter.put(
  '/settings',
  wrap(async (req, res) => {
    await writeSettings(settingsInput.parse(req.body));
    res.json({ ok: true });
  }),
);
