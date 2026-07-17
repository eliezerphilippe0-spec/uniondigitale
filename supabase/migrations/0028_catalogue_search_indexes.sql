-- ============================================================================
-- 0028 — BL-134 (C-7b) : index recherche/perf catalogue
-- ============================================================================
-- Le catalogue et la recherche (lib/products.ts) filtrent toujours sur
-- status='published' triés par created_at desc, et cherchent en `ilike` sur
-- title/description (+ désormais le nom du créateur, BL-134). L'index simple
-- sur `status` sert le filtre mais pas le tri ; `ilike '%...%'` fait un seq
-- scan sans trigram. Aucun changement de comportement — perf uniquement.

create extension if not exists pg_trgm;

-- Remplace products_status_idx (0001) : la colonne composite sert aussi bien
-- les requêtes filtrant sur status seul que celles triées par created_at.
drop index if exists products_status_idx;
create index products_status_created_idx on products (status, created_at desc);

create index products_title_trgm_idx
  on products using gin (title gin_trgm_ops);
create index products_description_trgm_idx
  on products using gin (description gin_trgm_ops);

-- BL-134 : la recherche couvre maintenant le nom du créateur (lib/products.ts).
create index profiles_display_name_trgm_idx
  on profiles using gin (display_name gin_trgm_ops);
