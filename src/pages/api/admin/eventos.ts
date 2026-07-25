import type { APIRoute, APIContext } from "astro";
import { createSupabaseServer } from "../../../lib/supabase/server";
import { createSupabaseAdmin } from "../../../lib/supabase/admin";

/**
 * CRUD de eventos para el admin.
 *  GET    → todos los eventos (vigentes y pasados)
 *  POST   → crear (multipart: campos + foto opcional, va a event-photos)
 *  PATCH  → { id, is_active } activar/desactivar
 *  DELETE → { id } borra el evento y su foto del storage
 *
 * Las escrituras usan el service role (bypass RLS), por eso el guard de
 * admin acá es obligatorio.
 */

const json = (body: object, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

// 401 sin sesión, 403 con sesión sin permiso: el panel distingue "entrá de
// nuevo" de "no sos admin".
async function adminGate(context: APIContext): Promise<Response | null> {
  const supabase = createSupabaseServer(context);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return json({ error: "Sesión vencida" }, 401);

  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) return json({ error: "No autorizado" }, 403);
  return null;
}

// Los mensajes crudos de Postgres (constraints, columnas) no salen al
// cliente: se loguean y se responde genérico.
const dbError = (context: string, error: { message: string }) => {
  console.error(`Error eventos (${context}):`, error.message);
  return json({ error: "No se pudo completar la operación" }, 500);
};

export const GET: APIRoute = async (context) => {
  const denied = await adminGate(context);
  if (denied) return denied;
  const admin = createSupabaseAdmin();
  if (!admin) return json({ error: "Falta service role" }, 503);

  // Multi-barrio: el manager pide los eventos del barrio del selector
  const barrioId = context.url.searchParams.get("barrio");

  let query = admin
    .from("events")
    .select("*")
    .order("date", { ascending: false })
    .order("start_time", { ascending: true });
  if (barrioId) query = query.eq("barrio_id", barrioId);

  const { data, error } = await query;

  if (error) return dbError("listar", error);
  return json({ events: data }, 200);
};

// Solo imágenes que los navegadores muestran; la extensión sale del MIME
// real, no del nombre del archivo (evita subir .svg/.html al bucket público)
const IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export const POST: APIRoute = async (context) => {
  const denied = await adminGate(context);
  if (denied) return denied;
  const admin = createSupabaseAdmin();
  if (!admin) return json({ error: "Falta service role" }, 503);

  const form = await context.request.formData();
  const title = String(form.get("title") ?? "").trim();
  const date = String(form.get("date") ?? "").trim();
  const barrio_id = String(form.get("barrio_id") ?? "").trim();
  if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return json({ error: "Faltan título o fecha" }, 400);
  }
  if (!barrio_id) {
    return json({ error: "Falta el barrio del evento" }, 400);
  }

  const optional = (key: string) => {
    const v = String(form.get(key) ?? "").trim();
    return v || null;
  };

  // Mismo formato que `date`: validar acá da un mensaje claro en vez del
  // error crudo de Postgres.
  const end_date = optional("end_date");
  const start_time = optional("start_time");
  const end_time = optional("end_time");
  const TIME_RE = /^\d{2}:\d{2}(:\d{2})?$/;
  if (
    (end_date && !/^\d{4}-\d{2}-\d{2}$/.test(end_date)) ||
    (start_time && !TIME_RE.test(start_time)) ||
    (end_time && !TIME_RE.test(end_time))
  ) {
    return json({ error: "Fecha u horario con formato inválido" }, 400);
  }

  // Foto opcional → bucket público event-photos
  let image_url: string | null = null;
  const photo = form.get("photo");
  if (photo instanceof File && photo.size > 0) {
    // 4MB: el límite amable tiene que saltar ANTES que el de Vercel (4.5MB
    // de body), que corta con un error de plataforma ilegible.
    if (photo.size > 4 * 1024 * 1024) {
      return json({ error: "La foto no puede superar 4MB" }, 400);
    }
    const ext = IMAGE_TYPES[photo.type];
    if (!ext) {
      return json({ error: "La foto tiene que ser JPG, PNG o WebP" }, 400);
    }
    const path = `${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await admin.storage
      .from("event-photos")
      .upload(path, photo, { contentType: photo.type });
    if (upErr) return dbError("subir foto", upErr);
    image_url = admin.storage.from("event-photos").getPublicUrl(path)
      .data.publicUrl;
  }

  const { data, error } = await admin
    .from("events")
    .insert({
      barrio_id,
      title,
      date,
      end_date,
      start_time,
      end_time,
      location: optional("location"),
      description: optional("description"),
      image_url,
    })
    .select("*")
    .single();

  if (error) return dbError("crear", error);
  return json({ event: data }, 200);
};

export const PATCH: APIRoute = async (context) => {
  const denied = await adminGate(context);
  if (denied) return denied;
  const admin = createSupabaseAdmin();
  if (!admin) return json({ error: "Falta service role" }, 503);

  const { id, is_active } = await context.request.json();
  if (typeof id !== "string" || typeof is_active !== "boolean") {
    return json({ error: "Datos inválidos" }, 400);
  }

  const { error } = await admin
    .from("events")
    .update({ is_active })
    .eq("id", id);
  if (error) return dbError("actualizar", error);
  return json({ success: true }, 200);
};

export const DELETE: APIRoute = async (context) => {
  const denied = await adminGate(context);
  if (denied) return denied;
  const admin = createSupabaseAdmin();
  if (!admin) return json({ error: "Falta service role" }, 503);

  const { id } = await context.request.json();
  if (typeof id !== "string") return json({ error: "Datos inválidos" }, 400);

  // Borrar la foto del storage si la tiene
  const { data: ev } = await admin
    .from("events")
    .select("image_url")
    .eq("id", id)
    .single();
  const marker = "/event-photos/";
  if (ev?.image_url?.includes(marker)) {
    const path = decodeURIComponent(
      ev.image_url.slice(ev.image_url.indexOf(marker) + marker.length),
    );
    await admin.storage.from("event-photos").remove([path]);
  }

  const { error } = await admin.from("events").delete().eq("id", id);
  if (error) return dbError("borrar", error);
  return json({ success: true }, 200);
};
