-- Zabelie Digi — Storage (Vague 1)
-- Bucket PRIVÉ pour les fichiers livrables. L'accès se fait exclusivement par
-- URL signée délivrée côté serveur APRÈS paiement confirmé (app/api/download).
-- Upload : via le service role (app/api/products/asset), donc pas de policy
-- storage.objects côté client nécessaire.

insert into storage.buckets (id, name, public)
values ('product-files', 'product-files', false)
on conflict (id) do nothing;
