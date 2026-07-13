import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Next 16 : convention « proxy » (ex-« middleware »). Rafraîchit la session
// Supabase à chaque requête. Comportement inchangé — simple renommage du point
// d'entrée (le helper updateSession reste dans lib/supabase/middleware.ts).
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Tout sauf assets statiques et fichiers image.
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
