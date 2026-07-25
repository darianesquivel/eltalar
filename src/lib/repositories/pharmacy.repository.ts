import { supabase } from "../supabase";

/** Farmacia de turno, con los datos que necesita cualquier card del sitio. */
export type PharmacyTurn = {
  id: string;
  name: string;
  slug: string;
  address: string | null;
  phone: string | null;
  whatsapp: string | null;
  starts_at: string;
  ends_at: string;
};

const TURN_SELECT = `
  starts_at,
  ends_at,
  businesses!inner (
    id,
    name,
    slug,
    address,
    phone,
    whatsapp,
    barrio_id
  )
`;

function toTurn(raw: any): PharmacyTurn | null {
  const business = Array.isArray(raw.businesses)
    ? raw.businesses[0]
    : raw.businesses;
  if (!business) return null;

  return {
    id: business.id,
    name: business.name,
    slug: business.slug,
    address: business.address,
    phone: business.phone,
    whatsapp: business.whatsapp,
    starts_at: raw.starts_at,
    ends_at: raw.ends_at,
  };
}

/**
 * Farmacias de turno EN ESTE MOMENTO. Puede haber más de una.
 * El barrio viaja por el join !inner con businesses.
 */
export async function getCurrentTurns(
  barrioId: string,
): Promise<PharmacyTurn[]> {
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("pharmacy_turns")
    .select(TURN_SELECT)
    .eq("businesses.barrio_id", barrioId)
    .lte("starts_at", now)
    .gt("ends_at", now)
    .order("ends_at");

  if (error || !data) {
    console.error("Error getCurrentTurns:", error);
    return [];
  }

  return data.map(toTurn).filter((t): t is PharmacyTurn => t !== null);
}

/** La primera farmacia de turno (la card de la home muestra una sola). */
export async function getCurrentTurn(
  barrioId: string,
): Promise<PharmacyTurn | null> {
  const turns = await getCurrentTurns(barrioId);
  return turns[0] ?? null;
}
