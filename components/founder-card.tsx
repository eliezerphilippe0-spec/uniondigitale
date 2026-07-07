/**
 * Carte « Fondateur » affichée en bas du tableau de bord.
 * Photo à gauche, nom + titre à droite. Fond #0e0e0e, coins arrondis 12px,
 * cohérent avec les autres cards du dashboard.
 *
 * Le nom et le titre ci-dessous sont éditables librement.
 */
export function FounderCard() {
  return (
    <section className="mt-12">
      <h2 className="text-lg font-semibold">Fondateur</h2>
      <div
        className="mt-4 flex items-center gap-5 border border-line p-5"
        style={{ backgroundColor: "#0e0e0e", borderRadius: "12px" }}
      >
        <img
          src="/images/philippe-profile.jpg"
          alt="Philippe — fondateur de Zabelie Talent"
          className="h-24 w-24 shrink-0 object-cover object-top sm:h-28 sm:w-28"
          style={{ borderRadius: "12px" }}
        />
        <div>
          <p className="text-lg font-bold text-cloud">Eliezer Philippe</p>
          <p className="mt-1 text-sm text-mist">
            Fondateur &amp; CEO — Zabelie Talent
          </p>
        </div>
      </div>
    </section>
  );
}
