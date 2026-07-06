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
  "nav.topup": "Recharge",
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
  "product.pay.stripe": "Payer {usd} par carte",
  "product.pay.zelle": "Payer {usd} avec Zelle",
  "pay.redirect": "Redirection…",
  "pay.other": "Diaspora ? Payez en USD :",
  "product.delivery": "Livraison instantanée après confirmation du paiement.",
  "product.secure": "✓ Paiement sécurisé, confirmé serveur-à-serveur",
  "product.file": "✓ Téléchargement immédiat du fichier",
  "product.service": "✓ Mise en relation après paiement",
  "product.verifiedOnly": "✓ Avis réservés aux acheteurs vérifiés",
  "product.reviews": "Avis vérifiés",
  "product.reviews.note": "Seuls les acheteurs ayant payé peuvent laisser un avis.",
  "product.verified": "Achat vérifié ✓",
  "product.share": "sur Zabelie Digi :",
  "product.cta.bottom": "Acheter maintenant — {price} ↑",

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

  // Zelle (diaspora — flux semi-manuel)
  "zelle.title": "Paiement Zelle",
  "zelle.sub":
    "Envoyez le montant exact depuis votre application bancaire (Zelle), avec le mémo ci-dessous. Votre achat sera validé après vérification du virement — généralement sous 24 h.",
  "zelle.amount": "Montant exact à envoyer",
  "zelle.to": "Destinataire Zelle",
  "zelle.name": "Nom du compte",
  "zelle.memo": "Mémo à indiquer (important)",
  "zelle.memo.why":
    "Ce code nous permet de retrouver votre virement et de valider votre achat rapidement.",
  "zelle.ref.label": "Vous avez envoyé le paiement ?",
  "zelle.ref.ph": "Référence de confirmation Zelle (optionnel)",
  "zelle.sent": "J'ai envoyé le paiement",
  "zelle.done":
    "Merci ! Nous vérifions votre virement. Votre fichier apparaîtra dans « Mes achats » dès la confirmation.",

  // Partage
  "share.wa": "Partager sur WhatsApp",
  "share.copy": "Copier le lien",
  "share.copied": "Lien copié ✓",

  // Recharge téléphonique (V-11)
  "topup.title": "Recharge téléphone",
  "topup.sub":
    "Rechargez n'importe quel téléphone Digicel ou Natcom en quelques secondes. Payez avec MonCash — ou par Zelle depuis la diaspora.",
  "topup.operator": "Opérateur",
  "topup.phone.label": "Numéro à recharger",
  "topup.phone.ph": "Ex. 37 12 34 56",
  "topup.phone2.label": "Confirmez le numéro (nouvelle saisie)",
  "topup.phone2.why":
    "Un numéro erroné = recharge perdue. Vérifiez chaque chiffre.",
  "topup.mismatch": "Les deux numéros ne correspondent pas.",
  "topup.invalid": "Numéro haïtien invalide (8 chiffres, mobile 3X/4X).",
  "topup.detected": "Opérateur détecté",
  "topup.amount.label": "Montant de la recharge",
  "topup.receives": "Le numéro reçoit {face} HTG",
  "topup.status.payment_pending": "En attente du paiement…",
  "topup.status.paid": "Paiement reçu — envoi de la recharge…",
  "topup.status.fulfillment_pending": "Envoi de la recharge en cours…",
  "topup.status.delivered": "Recharge livrée ✓",
  "topup.status.failed": "La recharge a échoué.",
  "topup.status.refund_pending":
    "La recharge a échoué après paiement : remboursement en préparation vers votre moyen de paiement d'origine.",
  "topup.status.refunded":
    "Remboursé via votre moyen de paiement d'origine.",
  "topup.disabled":
    "Le service de recharge arrive bientôt. Revenez très vite !",
  "topup.legal":
    "Zabelie Digi est revendeur de recharge télécom : paiement puis livraison immédiate — aucun solde n'est stocké sur votre compte.",

  // Fondateur
  "founder.title": "Le mot du fondateur",
  "founder.quote":
    "Les opportunités ne se trouvent pas, elles se créent. Oser Agir.",
  "founder.name": "Éliezer Philippe",
  "founder.role": "Fondateur, Zabelie Digi",
} as const;

export type I18nKey = keyof typeof fr;

const ht: Record<I18nKey, string> = {
  "nav.catalog": "Katalòg",
  "nav.talents": "Talan",
  "nav.how": "Kijan sa mache",
  "nav.topup": "Rechaj",
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
  "product.pay.stripe": "Peye {usd} ak kat",
  "product.pay.zelle": "Peye {usd} ak Zelle",
  "pay.redirect": "N ap voye ou…",
  "pay.other": "Dyaspora ? Peye an USD :",
  "product.delivery": "Livrezon nan menm moman apre peman an konfime.",
  "product.secure": "✓ Peman sekirize, konfime sèvè-a-sèvè",
  "product.file": "✓ Telechaje fichye a nan menm moman",
  "product.service": "✓ Kontak ak kreyatè a apre peman",
  "product.verifiedOnly": "✓ Avi yo rezève pou achtè verifye sèlman",
  "product.reviews": "Avi verifye",
  "product.reviews.note": "Se sèlman achtè ki peye ki ka bay avi.",
  "product.verified": "Acha verifye ✓",
  "product.share": "sou Zabelie Digi :",
  "product.cta.bottom": "Achte kounye a — {price} ↑",

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

  "zelle.title": "Peman Zelle",
  "zelle.sub":
    "Voye montan egzak la ak aplikasyon bank ou (Zelle), avèk memo ki anba a. Acha ou ap valide apre nou verifye viman an — anjeneral nan mwens pase 24 èdtan.",
  "zelle.amount": "Montan egzak pou voye",
  "zelle.to": "Destinatè Zelle",
  "zelle.name": "Non kont lan",
  "zelle.memo": "Memo pou mete (enpòtan)",
  "zelle.memo.why":
    "Kòd sa a pèmèt nou jwenn viman ou an epi valide acha ou pi vit.",
  "zelle.ref.label": "Ou voye peman an deja ?",
  "zelle.ref.ph": "Referans konfimasyon Zelle (si ou genyen l)",
  "zelle.sent": "Mwen voye peman an",
  "zelle.done":
    "Mèsi ! N ap verifye viman ou an. Fichye ou ap parèt nan « Acha mwen yo » kou peman an konfime.",

  "share.wa": "Pataje sou WhatsApp",
  "share.copy": "Kopye lyen an",
  "share.copied": "Lyen kopye ✓",

  "topup.title": "Rechaj telefòn",
  "topup.sub":
    "Rechaje nenpòt telefòn Digicel oswa Natcom an kèk segonn. Peye ak MonCash — oswa ak Zelle depi dyaspora a.",
  "topup.operator": "Operatè",
  "topup.phone.label": "Nimewo pou rechaje a",
  "topup.phone.ph": "Egz. 37 12 34 56",
  "topup.phone2.label": "Konfime nimewo a (retape l)",
  "topup.phone2.why":
    "Yon move nimewo = rechaj la pèdi. Verifye chak chif byen.",
  "topup.mismatch": "De nimewo yo pa menm.",
  "topup.invalid": "Nimewo ayisyen an pa bon (8 chif, mobil 3X/4X).",
  "topup.detected": "Operatè nou detekte",
  "topup.amount.label": "Montan rechaj la",
  "topup.receives": "Nimewo a ap resevwa {face} HTG",
  "topup.status.payment_pending": "N ap tann peman an…",
  "topup.status.paid": "Peman an antre — n ap voye rechaj la…",
  "topup.status.fulfillment_pending": "Rechaj la ap pati…",
  "topup.status.delivered": "Rechaj la rive ✓",
  "topup.status.failed": "Rechaj la pa t pase.",
  "topup.status.refund_pending":
    "Rechaj la pa t pase apre peman an : n ap prepare ranbousman an sou menm mwayen peman ou te itilize a.",
  "topup.status.refunded":
    "Ranbouse sou menm mwayen peman ou te itilize a.",
  "topup.disabled": "Sèvis rechaj la ap vini talè konsa. Tounen vit !",
  "topup.legal":
    "Zabelie Digi se revandè rechaj telekòm : ou peye, rechaj la pati nan menm moman — nou pa janm kenbe okenn balans sou kont ou.",

  "founder.title": "Pawòl fondatè a",
  "founder.quote":
    "Opòtinite yo pa jwenn, se kreye yo kreye. Oze Aji.",
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
