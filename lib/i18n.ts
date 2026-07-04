/**
 * i18n Zabelie Digi — FR (défaut) + Kreyòl ayisyen (ht).
 * Dictionnaire maison, zéro dépendance (pages légères pour la 3G).
 * ⚠️ Kreyòl à faire relire par un locuteur natif avant le lancement public.
 * Parité des clés garantie par tests/i18n.test.ts.
 */

export type Lang = "fr" | "ht";
export const LANG_COOKIE = "zabelie_lang";
export const LANGS: Lang[] = ["fr", "ht"];

const fr = {
  // Nav / footer
  "nav.catalog": "Catalogue",
  "nav.talents": "Talents",
  "nav.how": "Comment ça marche",
  "nav.login": "Connexion",
  "nav.sell": "Vendre",
  "nav.dashboard": "Tableau de bord",
  "nav.logout": "Déconnexion",
  "footer.tagline":
    "La marketplace des produits digitaux et talents africains. Paiement mobile money, livraison instantanée.",
  "footer.explore": "Explorer",
  "footer.sell": "Vendre",
  "footer.become": "Devenir créateur",
  "footer.payment": "Paiement",
  "footer.natcash": "NatCash — bientôt",
  "footer.rights": "Tous droits réservés.",

  // Accueil
  "home.badge": "La marketplace digitale africaine",
  "home.h1.a": "Vendez vos",
  "home.h1.b": "produits digitaux",
  "home.h1.c": "et vos",
  "home.h1.d": "talents",
  "home.sub":
    "Templates, formations, beats, mentorat… Publiez, encaissez via mobile money et livrez instantanément. Pensé pour le contexte africain.",
  "home.cta.sell": "Commencer à vendre",
  "home.cta.browse": "Explorer le catalogue",
  "home.stat1": "digital & talents",
  "home.stat2": "paiement mobile",
  "home.stat3": "livraison après paiement",
  "home.stat3.v": "Instant",
  "home.trends": "Tendances du moment",
  "home.trends.sub": "Les produits et talents les plus demandés.",
  "home.all": "Tout voir →",
  "home.how": "Comment ça marche",
  "home.s1.t": "Publiez",
  "home.s1.b":
    "Mettez en ligne un produit digital ou une prestation en quelques minutes.",
  "home.s2.t": "Encaissez",
  "home.s2.b":
    "L'acheteur paie via MonCash. Le paiement est confirmé serveur-à-serveur.",
  "home.s3.t": "Livrez & retirez",
  "home.s3.b":
    "Livraison automatique du fichier, crédit de votre wallet, retrait de vos gains.",
  "home.final.a": "Votre talent mérite d'être",
  "home.final.b": "payé",
  "home.final.sub":
    "Rejoignez les créateurs qui monétisent leur savoir-faire sur Zabelie Digi.",
  "home.final.cta": "Créer ma boutique",

  // Catalogue
  "catalog.title": "Catalogue",
  "catalog.results": "résultat(s)",
  "catalog.for": "pour",
  "catalog.search.ph": "Rechercher un produit, un talent…",
  "catalog.search.btn": "Rechercher",
  "catalog.none": "Aucun résultat.",
  "catalog.reset": "Réinitialiser",

  // Produit
  "product.back": "← Retour au catalogue",
  "product.kind.file": "Fichier digital",
  "product.kind.service": "Service",
  "product.by": "par",
  "product.sales": "ventes",
  "product.reviews.badge": "avis vérifié(s)",
  "product.pay": "Payer {price} avec MonCash",
  "product.pay.loading": "Redirection vers MonCash…",
  "product.delivery": "Livraison instantanée après confirmation du paiement.",
  "product.secure": "✓ Paiement sécurisé, confirmé serveur-à-serveur",
  "product.file": "✓ Téléchargement immédiat du fichier",
  "product.service": "✓ Mise en relation après paiement",
  "product.verifiedOnly": "✓ Avis réservés aux acheteurs vérifiés",
  "product.reviews": "Avis vérifiés",
  "product.reviews.note": "Seuls les acheteurs ayant payé peuvent laisser un avis.",
  "product.verified": "Achat vérifié ✓",
  "product.share": "sur Zabelie Digi :",

  // Paiement
  "pay.ok.title": "Paiement confirmé",
  "pay.ok.body":
    "Merci ! Votre achat est validé. Votre fichier est disponible dans vos téléchargements.",
  "pay.ok.cta": "Voir mes achats",
  "pay.back": "Retour au catalogue",
  "pay.wait.title": "Paiement en cours de vérification",
  "pay.wait.body":
    "Nous confirmons votre paiement auprès de MonCash. Si le montant a été débité, votre achat sera validé automatiquement d'ici quelques instants — même si cette page a été interrompue.",
  "pay.wait.cta": "Vérifier mes achats",
  "pay.fail.title": "Paiement non confirmé",
  "pay.fail.body":
    "Le paiement n'a pas pu être validé. Aucun produit n'a été livré. Vous pouvez réessayer en toute sécurité.",
  "pay.fail.code": "Code :",
  "pay.order": "Commande",

  // Partage
  "share.wa": "Partager sur WhatsApp",
  "share.copy": "Copier le lien",
  "share.copied": "Lien copié ✓",

  // Fondateur
  "founder.title": "Le mot du fondateur",
  "founder.quote":
    "Zabelie Digi est né d'une conviction : le talent haïtien mérite des outils modernes pour être vendu, payé et respecté. Chaque créateur qui vit de son savoir-faire fait avancer tout le pays.",
  "founder.name": "Éliezer Philippe",
  "founder.role": "Fondateur, Zabelie Digi",
} as const;

export type I18nKey = keyof typeof fr;

const ht: Record<I18nKey, string> = {
  "nav.catalog": "Katalòg",
  "nav.talents": "Talan",
  "nav.how": "Kijan sa mache",
  "nav.login": "Konekte",
  "nav.sell": "Vann",
  "nav.dashboard": "Tablo bò",
  "nav.logout": "Dekonekte",
  "footer.tagline":
    "Makètplas pwodwi dijital ak talan afriken yo. Peman mobile money, livrezon nan menm moman.",
  "footer.explore": "Eksplore",
  "footer.sell": "Vann",
  "footer.become": "Vin kreyatè",
  "footer.payment": "Peman",
  "footer.natcash": "NatCash — talè konsa",
  "footer.rights": "Tout dwa rezève.",

  "home.badge": "Makètplas dijital afriken an",
  "home.h1.a": "Vann",
  "home.h1.b": "pwodwi dijital ou yo",
  "home.h1.c": "ak",
  "home.h1.d": "talan ou",
  "home.sub":
    "Modèl, fòmasyon, beat, akonpayman… Pibliye, resevwa lajan ak mobile money, epi livre nan menm moman. Fèt pou reyalite lakay.",
  "home.cta.sell": "Kòmanse vann",
  "home.cta.browse": "Gade katalòg la",
  "home.stat1": "dijital & talan",
  "home.stat2": "peman mobil",
  "home.stat3": "livrezon apre peman",
  "home.stat3.v": "Rapid",
  "home.trends": "Sa k ap mache kounye a",
  "home.trends.sub": "Pwodwi ak talan moun plis ap chèche yo.",
  "home.all": "Wè tout →",
  "home.how": "Kijan sa mache",
  "home.s1.t": "Pibliye",
  "home.s1.b": "Mete yon pwodwi dijital oswa yon sèvis an liy nan kèk minit.",
  "home.s2.t": "Resevwa lajan",
  "home.s2.b": "Achtè a peye ak MonCash. Peman an konfime sèvè-a-sèvè.",
  "home.s3.t": "Livre & retire",
  "home.s3.b":
    "Fichye a livre otomatikman, kòb la antre nan wallet ou, epi ou retire lajan ou.",
  "home.final.a": "Talan ou merite",
  "home.final.b": "peye",
  "home.final.sub":
    "Vin jwenn kreyatè k ap fè lajan ak konesans yo sou Zabelie Digi.",
  "home.final.cta": "Kreye boutik mwen",

  "catalog.title": "Katalòg",
  "catalog.results": "rezilta",
  "catalog.for": "pou",
  "catalog.search.ph": "Chèche yon pwodwi, yon talan…",
  "catalog.search.btn": "Chèche",
  "catalog.none": "Pa gen rezilta.",
  "catalog.reset": "Rekòmanse",

  "product.back": "← Tounen nan katalòg la",
  "product.kind.file": "Fichye dijital",
  "product.kind.service": "Sèvis",
  "product.by": "pa",
  "product.sales": "vant",
  "product.reviews.badge": "avi verifye",
  "product.pay": "Peye {price} ak MonCash",
  "product.pay.loading": "N ap voye ou sou MonCash…",
  "product.delivery": "Livrezon nan menm moman apre peman an konfime.",
  "product.secure": "✓ Peman sekirize, konfime sèvè-a-sèvè",
  "product.file": "✓ Telechaje fichye a nan menm moman",
  "product.service": "✓ Kontak ak kreyatè a apre peman",
  "product.verifiedOnly": "✓ Avi yo rezève pou achtè verifye sèlman",
  "product.reviews": "Avi verifye",
  "product.reviews.note": "Se sèlman achtè ki peye ki ka bay avi.",
  "product.verified": "Acha verifye ✓",
  "product.share": "sou Zabelie Digi :",

  "pay.ok.title": "Peman konfime",
  "pay.ok.body":
    "Mèsi! Acha ou valide. Fichye ou disponib nan telechajman ou yo.",
  "pay.ok.cta": "Wè acha mwen yo",
  "pay.back": "Tounen nan katalòg la",
  "pay.wait.title": "N ap verifye peman an",
  "pay.wait.body":
    "N ap konfime peman ou an ak MonCash. Si kòb la te soti, acha ou ap valide otomatikman nan kèk moman — menm si paj sa a te koupe.",
  "pay.wait.cta": "Tcheke acha mwen yo",
  "pay.fail.title": "Peman an pa konfime",
  "pay.fail.body":
    "Peman an pa t ka valide. Nou pa livre okenn pwodwi. Ou ka eseye ankò san pwoblèm.",
  "pay.fail.code": "Kòd :",
  "pay.order": "Kòmand",

  "share.wa": "Pataje sou WhatsApp",
  "share.copy": "Kopye lyen an",
  "share.copied": "Lyen kopye ✓",

  "founder.title": "Pawòl fondatè a",
  "founder.quote":
    "Zabelie Digi fèt ak yon konviksyon : talan ayisyen merite zouti modèn pou li vann, pou li peye, pou li respekte. Chak kreyatè k ap viv ak konesans li fè tout peyi a vanse.",
  "founder.name": "Éliezer Philippe",
  "founder.role": "Fondatè, Zabelie Digi",
};

export const DICT: Record<Lang, Record<I18nKey, string>> = { fr, ht };

/** Traduit une clé ; {vars} interpolées ; repli FR si clé absente. */
export function t(
  lang: Lang,
  key: I18nKey,
  vars?: Record<string, string>
): string {
  let s = DICT[lang]?.[key] ?? fr[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, v);
  }
  return s;
}

export function isLang(v: unknown): v is Lang {
  return v === "fr" || v === "ht";
}
