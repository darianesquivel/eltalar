import { supabase } from "../supabase";
import { todayInArgentina } from "../hours";

/** Oferta vigente ya aplanada para las cards (home y página de ofertas). */
export type ActiveOffer = {
  id: string;
  title: string;
  description: string | null;
  expires_at: string;
  business: {
    id: string;
    name: string;
    slug: string;
    address: string | null;
    whatsapp: string | null;
    is_featured: boolean;
  };
  coverUrl: string | null;
};

/**
 * Ofertas vigentes de negocios activos del barrio.
 * Orden: primero los destacados (es un beneficio del plan pago), después
 * por vencimiento más próximo.
 */
export async function getActiveOffers(
  barrioId: string,
  limit?: number,
): Promise<ActiveOffer[]> {
  const today = todayInArgentina();

  const { data, error } = await supabase
    .from("business_offers")
    .select(
      `
      id, title, description, expires_at,
      businesses!inner (
        id, name, slug, address, whatsapp, is_featured,
        business_photos ( url, is_cover, position )
      )
    `,
    )
    .gte("expires_at", today)
    .eq("businesses.barrio_id", barrioId)
    .eq("businesses.is_active", true)
    .order("expires_at");

  if (error || !data) {
    console.error("Error getActiveOffers:", error);
    return [];
  }

  const offers: ActiveOffer[] = data.map((raw: any) => {
    const business = Array.isArray(raw.businesses)
      ? raw.businesses[0]
      : raw.businesses;
    const photos = business?.business_photos ?? [];
    const cover =
      photos.find((p: any) => p.is_cover) ||
      photos
        .slice()
        .sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0))[0];

    return {
      id: raw.id,
      title: raw.title,
      description: raw.description,
      expires_at: raw.expires_at,
      business: {
        id: business.id,
        name: business.name,
        slug: business.slug,
        address: business.address,
        whatsapp: business.whatsapp,
        is_featured: business.is_featured,
      },
      coverUrl: cover?.url ?? null,
    };
  });

  offers.sort((a, b) => {
    const fa = a.business.is_featured ? 0 : 1;
    const fb = b.business.is_featured ? 0 : 1;
    if (fa !== fb) return fa - fb;
    return a.expires_at.localeCompare(b.expires_at);
  });

  return limit ? offers.slice(0, limit) : offers;
}
