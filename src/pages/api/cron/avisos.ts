import type { APIRoute } from "astro";
import { createSupabaseAdmin } from "../../../lib/supabase/admin";

/**
 * Mantenimiento diario de los avisos de vecinos (cron de Vercel, ver
 * vercel.json).
 *
 *  1. Marca como vencidos los publicados que pasaron los 30 días.
 *  2. Borra los que llevan más de una semana vencidos, con su foto.
 *
 * La ventana de gracia le da al vecino tiempo de renovar con un click; si
 * no lo hace, el aviso se va de la base y la foto del storage, para no
 * acumular basura.
 *
 * Se protege con CRON_SECRET: Vercel manda ese valor en el header
 * Authorization cuando la variable existe en el proyecto.
 */

const GRACE_DAYS = 7;

const json = (body: object, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export const GET: APIRoute = async ({ request }) => {
  const secret = import.meta.env.CRON_SECRET;
  if (!secret) {
    return json({ error: "CRON_SECRET no configurado" }, 503);
  }

  if (request.headers.get("Authorization") !== `Bearer ${secret}`) {
    return json({ error: "unauthorized" }, 401);
  }

  const admin = createSupabaseAdmin();
  if (!admin) {
    return json({ error: "service role no configurada" }, 503);
  }

  const now = new Date();
  const limite = new Date(now.getTime() - GRACE_DAYS * 86_400_000);

  // 1. BORRAR primero, VENCER después. Al revés, si el cron se salteaba
  //    más de una semana, un aviso podía marcarse vencido y borrarse en la
  //    MISMA corrida (los dos pasos miran expires_at): el vecino se quedaba
  //    sin su semana de gracia para renovar. En este orden, un aviso recién
  //    marcado como vencido siempre sobrevive hasta la corrida siguiente.
  //
  //    Se borran: vencidos con la gracia cumplida, y rechazados con más de
  //    una semana (su expires_at es created_at+30, no significa nada — el
  //    spam rechazado no tiene por qué vivir 37 días en la base).
  const [{ data: expirados }, { data: rechazados }] = await Promise.all([
    admin
      .from("classifieds")
      .select("id, photo_url")
      .eq("status", "expired")
      .lt("expires_at", limite.toISOString()),
    admin
      .from("classifieds")
      .select("id, photo_url")
      .eq("status", "rejected")
      .lt("created_at", limite.toISOString()),
  ]);

  const aBorrar = [...(expirados ?? []), ...(rechazados ?? [])];

  // La URL pública viene percent-encodeada: sin decodificar, Storage no
  // encuentra el objeto y la foto queda huérfana para siempre.
  const paths = aBorrar
    .map((a) => a.photo_url?.split("/classified-photos/")[1])
    .filter((p): p is string => Boolean(p))
    .map((p) => {
      try {
        return decodeURIComponent(p);
      } catch {
        return p;
      }
    });

  // En tandas: un remove() con demasiados objetos falla entero y los deja
  // todos huérfanos. Si una tanda falla, se sigue igual — las filas
  // correspondientes se borran y se loguea; mejor eso que reintentar
  // borrar filas cuyo estado ya no conocemos.
  let fotosBorradas = 0;
  for (let i = 0; i < paths.length; i += 100) {
    const batch = paths.slice(i, i + 100);
    const { error } = await admin.storage
      .from("classified-photos")
      .remove(batch);
    if (error) {
      console.error("Error borrando fotos de avisos:", error);
    } else {
      fotosBorradas += batch.length;
    }
  }

  let borrados = 0;
  if (aBorrar.length > 0) {
    const { error } = await admin
      .from("classifieds")
      .delete()
      .in(
        "id",
        aBorrar.map((a) => a.id),
      );

    if (error) {
      console.error("Error borrando avisos vencidos:", error);
      return json({ error: "No se pudieron borrar los avisos" }, 500);
    }
    borrados = aBorrar.length;
  }

  // 2. Vencidos: salen del listado público (que igual filtra por fecha) y
  //    el vecino los ve como "vencido" en Mis avisos, con botón de renovar.
  const { data: vencidos, error: expireError } = await admin
    .from("classifieds")
    .update({ status: "expired" })
    .eq("status", "published")
    .lte("expires_at", now.toISOString())
    .select("id");

  if (expireError) {
    // Con error real el cron tiene que fallar (500), no reportar "0 vencidos"
    console.error("Error venciendo avisos:", expireError);
    return json({ error: "No se pudieron vencer los avisos" }, 500);
  }

  return json(
    {
      vencidos: vencidos?.length ?? 0,
      borrados,
      fotosBorradas,
    },
    200,
  );
};
