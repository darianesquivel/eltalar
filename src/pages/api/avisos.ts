import type { APIRoute } from "astro";
import { createSupabaseAdmin } from "../../lib/supabase/admin";
import { createSupabaseServer } from "../../lib/supabase/server";
import { isClassifiedCategory } from "../../lib/repositories/classified.repository";

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
 * Se puede sin cuenta (como el formulario de contacto): por eso entra por
 * acá con la service role y no con una policy de insert para anónimos.
 * Todo aviso nace 'pending' y lo publica un admin. Si el vecino está
 * logueado, queda como dueño y después puede editarlo.
 */
export const POST: APIRoute = async (context) => {
  try {
    const admin = createSupabaseAdmin();
    if (!admin) {
      return json(
        {
          error: "not_configured",
          message: "La publicación de avisos todavía no está habilitada.",
        },
        503,
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

    // Si hay sesión, el aviso queda a nombre del vecino
    const supabase = createSupabaseServer(context);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await admin.from("classifieds").insert({
      barrio_id: context.locals.barrio.id,
      owner_id: user?.id ?? null,
      category,
      title: title.trim(),
      description:
        typeof description === "string" && description.trim()
          ? description.trim()
          : null,
      price_text:
        typeof priceText === "string" && priceText.trim()
          ? priceText.trim()
          : null,
      whatsapp: phone,
      author_name: authorName.trim(),
      status: "pending",
    });

    if (error) {
      console.error("Error guardando aviso:", error);
      return json({ error: "No pudimos guardar tu aviso" }, 500);
    }

    return json({ success: true }, 200);
  } catch (err) {
    console.error(err);
    return json({ error: "Error inesperado" }, 500);
  }
};
