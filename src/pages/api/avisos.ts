import type { APIRoute } from "astro";
import { createSupabaseServer } from "../../lib/supabase/server";
import { rateLimit, tooMany } from "../../lib/rateLimit";
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

type AvisoFields = {
  category: string;
  title: string;
  description: string | null;
  price_text: string | null;
  whatsapp: string;
  author_name: string;
  photo_url: string | null;
};

type Validated =
  | { ok: true; fields: AvisoFields }
  | { ok: false; response: Response };

/**
 * Valida y normaliza el cuerpo de un aviso (crear y editar comparten reglas).
 * Devuelve los campos listos para insertar/actualizar, o la respuesta de error.
 */
function validateAviso(body: any, userId: string): Validated {
  const { category, title, description, priceText, whatsapp, authorName } =
    body ?? {};
  const photoUrl = body?.photoUrl;

  if (
    !isClassifiedCategory(category) ||
    typeof title !== "string" ||
    typeof authorName !== "string" ||
    typeof whatsapp !== "string" ||
    !title.trim() ||
    !authorName.trim() ||
    !cleanWhatsapp(whatsapp)
  ) {
    return { ok: false, response: json({ error: "Datos incompletos" }, 400) };
  }

  if (
    title.length > 120 ||
    authorName.length > 80 ||
    (typeof description === "string" && description.length > 1500) ||
    (typeof priceText === "string" && priceText.length > 40)
  ) {
    return {
      ok: false,
      response: json({ error: "El aviso es demasiado largo" }, 400),
    };
  }

  const phone = cleanWhatsapp(whatsapp);
  if (phone.length < 8 || phone.length > 15) {
    return {
      ok: false,
      response: json({ error: "El WhatsApp no parece válido" }, 400),
    };
  }

  // La foto tiene que ser una que se acaba de subir a NUESTRO bucket, y a
  // la carpeta del propio usuario: si no, cualquiera podría hacer que la
  // card muestre una imagen de otro sitio.
  const expectedPrefix = `${import.meta.env.PUBLIC_SUPABASE_URL}/storage/v1/object/public/classified-photos/${userId}/`;
  const photo =
    typeof photoUrl === "string" && photoUrl.startsWith(expectedPrefix)
      ? photoUrl
      : null;

  if (photoUrl && !photo) {
    return { ok: false, response: json({ error: "La foto no es válida" }, 400) };
  }

  return {
    ok: true,
    fields: {
      category,
      title: title.trim(),
      description:
        typeof description === "string" && description.trim()
          ? description.trim()
          : null,
      price_text: formatPriceText(priceText),
      whatsapp: phone,
      author_name: authorName.trim(),
      photo_url: photo,
    },
  };
}

/** Ruta dentro del bucket a partir de la URL pública (para borrar). */
function storagePath(photoUrl: string): string | null {
  const raw = photoUrl.split("/classified-photos/")[1];
  if (!raw) return null;
  try {
    // La URL pública viene percent-encodeada: sin decodificar, Storage no
    // encuentra el objeto y la foto queda huérfana para siempre.
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

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

    if (!context.locals.barrio.id) {
      // Sin barrio resuelto (tabla caída) el insert fallaría con un error
      // de uuid ilegible: mejor un mensaje honesto.
      return json(
        { error: "No pudimos guardar tu aviso. Probá de nuevo más tarde." },
        503,
      );
    }

    // Por usuario: una cuenta no puede inundar la cola de moderación
    if (!rateLimit(`avisos:${user.id}`, 5, 60 * 60_000)) {
      return tooMany();
    }

    const body = await context.request.json().catch(() => null);

    // Honeypot: el campo "company" está oculto en el form; solo lo completan
    // los bots. Respondemos éxito falso para no darles señal de que fallaron.
    if (body?.company) {
      return json({ success: true }, 200);
    }

    const validated = validateAviso(body, user.id);
    if (!validated.ok) return validated.response;

    const { data: saved, error } = await supabase
      .from("classifieds")
      .insert({
        barrio_id: context.locals.barrio.id,
        owner_id: user.id,
        ...validated.fields,
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

/**
 * Editar un aviso propio. Mismas validaciones que publicar (antes la edición
 * escribía directo desde el navegador y se las salteaba todas). La RLS limita
 * al dueño y el aviso vuelve a la cola de moderación.
 */
export const PUT: APIRoute = async (context) => {
  try {
    const supabase = createSupabaseServer(context);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return json(
        { error: "unauthorized", message: "Entrá con tu cuenta para editar." },
        401,
      );
    }

    if (!rateLimit(`avisos-edit:${user.id}`, 20, 60 * 60_000)) {
      return tooMany();
    }

    const body = await context.request.json().catch(() => null);
    const id = body?.id;
    if (typeof id !== "string" || !id) {
      return json({ error: "Datos incompletos" }, 400);
    }

    if (body?.company) {
      return json({ success: true }, 200);
    }

    const validated = validateAviso(body, user.id);
    if (!validated.ok) return validated.response;

    // La foto anterior, para limpiarla del bucket si la cambió o la sacó
    const { data: previous } = await supabase
      .from("classifieds")
      .select("photo_url")
      .eq("id", id)
      .eq("owner_id", user.id)
      .maybeSingle();

    if (!previous) {
      return json({ error: "No encontramos ese aviso" }, 404);
    }

    const { data: saved, error } = await supabase
      .from("classifieds")
      .update({
        ...validated.fields,
        // Editado = vuelve a revisión, para que no se cuele nada al feed
        status: "pending",
        published_at: null,
      })
      .eq("id", id)
      .eq("owner_id", user.id)
      .select("id");

    if (error) {
      console.error("Error editando aviso:", error);
      return json({ error: "No pudimos guardar los cambios" }, 500);
    }

    if (!saved || saved.length === 0) {
      return json({ error: "No pudimos guardar los cambios" }, 409);
    }

    // Recién ahora (con la fila ya actualizada) se borra la foto reemplazada:
    // al revés, un update fallido dejaba el aviso apuntando a una foto muerta.
    const newPhoto = validated.fields.photo_url;
    if (previous.photo_url && previous.photo_url !== newPhoto) {
      const path = storagePath(previous.photo_url);
      if (path && path.startsWith(`${user.id}/`)) {
        const { error: removeError } = await supabase.storage
          .from("classified-photos")
          .remove([path]);
        if (removeError) {
          console.error("No se pudo borrar la foto vieja:", removeError);
        }
      }
    }

    return json({ success: true }, 200);
  } catch (err) {
    console.error(err);
    return json({ error: "Error inesperado" }, 500);
  }
};
