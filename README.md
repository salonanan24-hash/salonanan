# ANAN Electronics Warehouse

Storefront and API foundation for מחסני ענאן / معرض عنان للأجهزة الكهربائية.

Phase 1 is a pnpm monorepo with a Hebrew-and-Arabic storefront shell, a local development catalog, and an Express health API. Checkout does not create orders. Payments are not connected. Supabase is scaffolded only: there is no database connection until you add credentials.

## Requirements

- Node.js 20 or newer
- pnpm 10

If `pnpm` is not on your PATH:

```bash
corepack enable
corepack prepare pnpm@10.15.1 --activate
```

If Corepack cannot symlink into `/usr/local/bin`, run pnpm through Corepack:

```bash
corepack pnpm install
corepack pnpm dev
```

## Setup

From the repository root:

```bash
pnpm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

Leave the Supabase values empty until a project exists. The site and the health check run without them.

## Scripts

| Command          | What it does                                               |
| ---------------- | ---------------------------------------------------------- |
| `pnpm dev`       | Builds `@anan/shared`, then starts the web app and the API |
| `pnpm typecheck` | Builds shared types, then typechecks every package         |
| `pnpm lint`      | ESLint                                                     |
| `pnpm build`     | Production build of shared, API, and web                   |
| `pnpm format`    | Prettier                                                   |

## Local URLs

- Storefront: http://localhost:5173
- API health: http://localhost:4000/api/health

The web dev server proxies `/api` to the API.

Production start for the API, after `pnpm build`:

```bash
pnpm --filter @anan/api start
```

Preview the built storefront:

```bash
pnpm --filter @anan/web preview
```

## Layout

```text
apps/web        React, Vite, Tailwind storefront
apps/api        Express API
packages/shared Zod schemas and catalog types
supabase        Client notes and an empty migrations folder
docs            Intended database model
```

The original logo PDF is kept at `apps/web/src/assets/brand/anan-logo-source.pdf`. The header uses `apps/web/public/brand/anan-logo.png`, made from that file by removing the black page background. The mark’s proportions and red/blue colors are unchanged.

## Languages

Hebrew is the default. Arabic is available from the header switcher. Both use RTL. Visible interface copy is in `apps/web/src/i18n`.

## Development catalog

Product cards, prices, discounts, and brand names on the homepage are fixtures in `apps/web/src/data/catalog.ts`. A notice on the page states that they are not ANAN inventory. The cart is stored in the browser only. The coupon field checks the code shape and does not change a price. The checkout page does not submit an order or collect card data.

Final prices, stock reservations, orders, and payment checks belong on the API in later phases.

## Supabase

See `supabase/README.md` and `docs/data-model.md`. Do not commit real keys. The service-role key must stay in `apps/api/.env`.

## Suggested next phase

Replace the fixture catalog with read-only Supabase tables for categories, brands, products, images, and attributes, including Row Level Security for public reads. Keep price and stock responses on the API. Customer Auth can follow that, still without payments or live checkout.
