import { supabase } from "../supabase";
import { getBusinessStatus } from "../businessHours";

/* =======================
   TYPES
======================= */

export interface BusinessPhoto {
  id: string;
  url: string;
  is_cover: boolean;
  position: number | null;
}

interface GetBusinessesOptions {
  featured?: boolean;
  limit?: number;
}

/* =======================
  getAllBusinesses + getIsFeaturedBusinesses
======================= */

export async function getBusinesses(options: GetBusinessesOptions = {}) {
  const { featured, limit } = options;

  let query = supabase
    .from("businesses")
    .select(
      `
      *,
      categories ( id, name, slug ),
      business_hours ( day_of_week, open_time, close_time, is_closed ),
      business_photos ( id, url, is_cover, position )
    `
    )
    .eq("is_active", true)
    .order("priority", { ascending: false });

  if (featured === true) {
    query = query.eq("is_featured", true);
  }

  if (limit) {
    query = query.limit(limit);
  }

  const { data, error } = await query;

  if (error || !data) {
    console.error("Error getBusinesses:", error);
    return [];
  }

  return data.map((b) => {
    const status = getBusinessStatus(b.business_hours ?? []);

    const photos: BusinessPhoto[] = Array.isArray(b.business_photos)
      ? b.business_photos
      : [];

    const coverPhoto: BusinessPhoto | null =
      photos.find((p) => p.is_cover) ||
      photos.slice().sort((a, b) => (a.position ?? 0) - (b.position ?? 0))[0] ||
      null;

    return {
      ...b,
      ...status,
      coverPhoto,
    };
  });
}

export async function getBusinessBySlug(slug: string) {
  const { data, error } = await supabase
    .from("businesses")
    .select(
      `
      *,
      categories ( id, name, slug ),
      business_hours ( day_of_week, open_time, close_time, is_closed ),
      business_photos ( id, url, is_cover, position )
    `
    )
    .eq("slug", slug)
    .single();

  if (error || !data) {
    console.error("Error getBusinessBySlug:", error);
    return null;
  }

  const status = getBusinessStatus(data.business_hours ?? []);

  const photos: BusinessPhoto[] = Array.isArray(data.business_photos)
    ? data.business_photos
    : [];

  const coverPhoto: BusinessPhoto | null =
    photos.find((p) => p.is_cover) ||
    photos.slice().sort((a, b) => (a.position ?? 0) - (b.position ?? 0))[0] ||
    null;

  return {
    ...data,
    ...status,
    coverPhoto,
  };
}

