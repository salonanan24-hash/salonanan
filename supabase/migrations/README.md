# Migrations

`20261022183000_admin_catalog.sql` creates the admin catalog tables and turns on Row Level Security. `20261023120000_field_sections.sql` adds the product-page section of each category field. `20261023133000_category_images.sql` stores an image on each category and subcategory. `20261023140000_brand_images.sql` stores an image on each brand. The browser cannot read or write these tables. The API uses the service role: public visitors read `GET /api/catalog`, and admin writes happen after the server checks the admin account.
