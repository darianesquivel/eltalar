import type { APIRoute } from "astro";
import { createSupabaseServer } from "../../lib/supabase/server";

const json = (body: object, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

/**
 * Reseña de un vecino sobre un negocio.
 *
 * Hace falta estar logueado: se escribe con el cliente de sesión, así la RLS
 * verifica que author_id sea el propio usuario y que el status sea 'pending'.
 * La reseña se ve recién cuando un admin la aprueba.
 */
export const POST: APIRoute = async (context) => {
  try {
    const supabase = createSupabaseServer(context);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return json(
        {
          error: "unauthorized",
          message: "Entrá con tu cuenta para dejar una reseña.",
        },
        401,
      );
    }

    const { businessId, rating, comment } = await context.request.json();

    const score = Number(rating);
    if (
      typeof businessId !== "string" ||
      !businessId.trim() ||
      !Number.isInteger(score) ||
      score < 1 ||
      score > 5
    ) {
      return json({ error: "Datos incompletos" }, 400);
    }

    if (typeof comment === "string" && comment.length > 1000) {
      return json({ error: "El comentario es demasiado largo" }, 400);
    }

    // Nombre de la cuenta de Google; si no vino, la parte del email
    const metadata = user.user_metadata ?? {};
    const authorName =
      (metadata.full_name as string) ||
      (metadata.name as string) ||
      user.email?.split("@")[0] ||
      "Vecino";

    const payload = {
      business_id: businessId,
      author_id: user.id,
      author_name: authorName.slice(0, 80),
      rating: score,
      comment: typeof comment === "string" && comment.trim() ? comment.trim() : null,
      status: "pending",
    };

    // Una reseña por persona y por negocio. No se usa upsert porque el índice
    // único es PARCIAL (where author_id is not null) y Postgres no puede
    // inferirlo desde ON CONFLICT: se busca la existente y se actualiza.
    const { data: existing } = await supabase
      .from("reviews")
      .select("id")
      .eq("business_id", businessId)
      .eq("author_id", user.id)
      .maybeSingle();

    const { data: saved, error } = existing
      ? await supabase
          .from("reviews")
          .update(payload)
          .eq("id", existing.id)
          .select("id")
      : await supabase.from("reviews").insert(payload).select("id");

    if (error) {
      console.error("Error guardando reseña:", error);
      return json({ error: "No pudimos guardar tu reseña" }, 500);
    }

    // La RLS puede filtrar la fila sin devolver error: si no volvió nada,
    // la escritura no ocurrió y no hay que decirle al vecino que sí.
    if (!saved || saved.length === 0) {
      return json(
        {
          error: "not_saved",
          message: "No pudimos guardar tu reseña. Probá de nuevo más tarde.",
        },
        409,
      );
    }

    return json({ success: true, updated: Boolean(existing) }, 200);
  } catch (err) {
    console.error(err);
    return json({ error: "Error inesperado" }, 500);
  }
};
