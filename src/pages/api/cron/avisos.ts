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

  // 1. Vencidos: salen del listado público (que igual filtra por fecha) y
  //    el vecino los ve como "vencido" en Mis avisos, con botón de renovar.
  const { data: vencidos } = await admin
    .from("classifieds")
    .update({ status: "expired" })
    .eq("status", "published")
    .lte("expires_at", now.toISOString())
    .select("id");

  // 2. Los que ya pasaron la semana de gracia: primero la foto, después la
  //    fila (si falla el borrado de la fila, la foto ya no está, pero un
  //    aviso sin foto molesta menos que un archivo huérfano para siempre).
  const { data: aBorrar } = await admin
    .from("classifieds")
    .select("id, photo_url")
    .lt("expires_at", limite.toISOString())
    .in("status", ["expired", "rejected"]);

  const paths = (aBorrar ?? [])
    .map((a) => a.photo_url?.split("/classified-photos/")[1])
    .filter((p): p is string => Boolean(p));

  if (paths.length > 0) {
    const { error } = await admin.storage
      .from("classified-photos")
      .remove(paths);
    if (error) console.error("Error borrando fotos de avisos:", error);
  }

  let borrados = 0;
  if (aBorrar && aBorrar.length > 0) {
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

  return json(
    {
      vencidos: vencidos?.length ?? 0,
      borrados,
      fotosBorradas: paths.length,
    },
    200,
  );
};
