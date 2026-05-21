-- ─── Storage policies for the product-images bucket ─────────────────
-- The bucket was created with only a public-read SELECT policy, so
-- authenticated users (including the admin) had no INSERT/UPDATE/DELETE
-- rights and every upload from /admin/products failed at the RLS layer.
--
-- Admin gating is enforced at the route level (app/(admin)/admin/layout
-- redirects non-admin to /home), so any authenticated session reaching
-- the uploadProductImageAction server action is the admin. Scoping the
-- policies to the `authenticated` role is the right granularity here.

create policy "Authenticated insert product-images"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'product-images');

create policy "Authenticated update product-images"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'product-images')
  with check (bucket_id = 'product-images');

create policy "Authenticated delete product-images"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'product-images');
