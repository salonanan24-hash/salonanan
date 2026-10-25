# Supabase

Phase 1 prepares the client and the migration folder. It does not create a project, apply SQL, or open a database connection.

## Credentials

Copy the examples and fill them only on your machine:

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

| Variable                    | Where                            | Purpose                                     |
| --------------------------- | -------------------------------- | ------------------------------------------- |
| `SUPABASE_URL`              | API                              | Project URL                                 |
| `SUPABASE_SERVICE_ROLE_KEY` | API only                         | Server client. Bypasses Row Level Security. |
| `SUPABASE_ANON_KEY`         | API and `VITE_SUPABASE_ANON_KEY` | Public client for Auth later                |
| `VITE_SUPABASE_URL`         | Web                              | Same project URL, safe to expose            |

Do not put the service-role key in any `VITE_` variable or in frontend code.

`GET /api/health` reports `supabase: "configured"` or `"not_configured"` from the presence of `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. That flag is not a connectivity test.

The server helper is `getSupabaseAdmin()` in `apps/api/src/lib/supabase.ts`. The browser helper is `getBrowserSupabase()` in `apps/web/src/lib/supabase.ts`. Neither is called during Phase 1 page loads.

## Migrations

Add SQL files to `supabase/migrations` in a later phase. See `docs/data-model.md` for the intended tables. Do not commit secrets beside those files.
