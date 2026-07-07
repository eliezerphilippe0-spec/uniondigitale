-- Zabelie Digi — projet TOTALEMENT INDÉPENDANT (décision utilisateur, ferme).
-- Aucune fusion prévue avec Zabelie 1 ni aucun autre projet. On retire la
-- passerelle dormante prévue « au cas où » par l'ancienne V-9.
-- (Sur une base déjà déployée : exécuter cette migration ; sur une base neuve,
--  schema.sql inclut créé-puis-supprimé, résultat identique.)

alter table profiles drop column if exists zabelie1_user_id;
