-- ─── Free-text product type label ───────────────────────────────────
-- products.product_type is a tight enum ('shirt' | 'pant') that drives
-- how sizes render and how the PDF groups line items. The visible
-- "Tipo" field in admin used to be locked to the same enum, which
-- meant admin could only call things "Camisa" or "Pantalón" — no
-- "Chaleco", "Gorra", "Casaca", "Polo", etc.
--
-- New `type_label` column stores whatever the admin types. The
-- product_type enum stays as a separate "size shape" hint
-- (camisa-style S/M/L vs pantalón-style waist/inseam) so the
-- size UI and PDF section split keep working.

alter table products
    add column if not exists type_label text;

update products
   set type_label = case product_type
       when 'shirt' then 'Camisa'
       when 'pant'  then 'Pantalón'
       else null
   end
 where type_label is null;
