import type { APIRoute } from "astro";
import { createSupabaseServer } from "../../lib/supabase/server";
import {
  formatPriceText,
  isClassifiedCategory,
} from "../../lib/repositories/classified.repository";

const json = (body: object, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

// Solo dígitos, con o sin +: se guarda normalizado para armar el wa.me
const cleanWhatsapp = (value: string) => value.replace(/[^\d]/g, "");

/**
 * Publicar un aviso de vecino.
 *
 * Hace falta estar logueado (Google): un aviso sin dueño no se puede
 * atribuir ni bloquear si es spam. Se escribe con el cliente de sesión, así
 * la RLS verifica que owner_id sea el propio usuario y que el estado sea
 * 'pending'. El aviso se ve recién cuando un admin lo aprueba.
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
          message: "Entrá con tu cuenta para publicar un aviso.",
        },
        401,
      );
    }

    const body = await context.request.json();
    const {
      category,
      title,
      description,
      priceText,
      whatsapp,
      authorName,
      company,
    } = body;

    // Honeypot: el campo "company" está oculto en el form; solo lo completan
    // los bots. Respondemos éxito falso para no darles señal de que fallaron.
    if (company) {
      return json({ success: true }, 200);
    }

    if (
      !isClassifiedCategory(category) ||
      typeof title !== "string" ||
      typeof authorName !== "string" ||
      typeof whatsapp !== "string" ||
      !title.trim() ||
      !authorName.trim() ||
      !cleanWhatsapp(whatsapp)
    ) {
      return json({ error: "Datos incompletos" }, 400);
    }

    if (
      title.length > 120 ||
      authorName.length > 80 ||
      (typeof description === "string" && description.length > 1500) ||
      (typeof priceText === "string" && priceText.length > 40)
    ) {
      return json({ error: "El aviso es demasiado largo" }, 400);
    }

    const phone = cleanWhatsapp(whatsapp);
    if (phone.length < 8 || phone.length > 15) {
      return json({ error: "El WhatsApp no parece válido" }, 400);
    }

    const { data: saved, error } = await supabase
      .from("classifieds")
      .insert({
        barrio_id: context.locals.barrio.id,
        owner_id: user.id,
        category,
        title: title.trim(),
        description:
          typeof description === "string" && description.trim()
            ? description.trim()
            : null,
        price_text: formatPriceText(priceText),
        whatsapp: phone,
        author_name: authorName.trim(),
        status: "pending",
      })
      .select("id");

    if (error) {
      console.error("Error guardando aviso:", error);
      return json({ error: "No pudimos guardar tu aviso" }, 500);
    }

    // La RLS puede filtrar la fila sin devolver error: si no volvió nada,
    // la escritura no ocurrió y no hay que decirle al vecino que sí.
    if (!saved || saved.length === 0) {
      return json(
        {
          error: "not_saved",
          message: "No pudimos guardar tu aviso. Probá de nuevo más tarde.",
        },
        409,
      );
    }

    return json({ success: true }, 200);
  } catch (err) {
    console.error(err);
    return json({ error: "Error inesperado" }, 500);
  }
};
