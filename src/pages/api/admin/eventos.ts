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

async function requireAdmin(context: APIContext) {
  const supabase = createSupabaseServer(context);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: isAdmin } = await supabase.rpc("is_admin");
  return isAdmin ? user : null;
}

export const GET: APIRoute = async (context) => {
  if (!(await requireAdmin(context))) return json({ error: "No autorizado" }, 403);
  const admin = createSupabaseAdmin();
  if (!admin) return json({ error: "Falta service role" }, 500);

  const { data, error } = await admin
    .from("events")
    .select("*")
    .order("date", { ascending: false })
    .order("start_time", { ascending: true });

  if (error) return json({ error: error.message }, 500);
  return json({ events: data }, 200);
};

export const POST: APIRoute = async (context) => {
  if (!(await requireAdmin(context))) return json({ error: "No autorizado" }, 403);
  const admin = createSupabaseAdmin();
  if (!admin) return json({ error: "Falta service role" }, 500);

  const form = await context.request.formData();
  const title = String(form.get("title") ?? "").trim();
  const date = String(form.get("date") ?? "").trim();
  if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return json({ error: "Faltan título o fecha" }, 400);
  }

  const optional = (key: string) => {
    const v = String(form.get(key) ?? "").trim();
    return v || null;
  };

  // Foto opcional → bucket público event-photos
  let image_url: string | null = null;
  const photo = form.get("photo");
  if (photo instanceof File && photo.size > 0) {
    if (photo.size > 5 * 1024 * 1024) {
      return json({ error: "La foto no puede superar 5MB" }, 400);
    }
    const ext = (photo.name.split(".").pop() || "jpg").toLowerCase();
    const path = `${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await admin.storage
      .from("event-photos")
      .upload(path, photo, { contentType: photo.type });
    if (upErr) return json({ error: `Foto: ${upErr.message}` }, 500);
    image_url = admin.storage.from("event-photos").getPublicUrl(path).data
      .publicUrl;
  }

  const { data, error } = await admin
    .from("events")
    .insert({
      title,
      date,
      end_date: optional("end_date"),
      start_time: optional("start_time"),
      end_time: optional("end_time"),
      location: optional("location"),
      description: optional("description"),
      image_url,
    })
    .select("*")
    .single();

  if (error) return json({ error: error.message }, 500);
  return json({ event: data }, 200);
};

export const PATCH: APIRoute = async (context) => {
  if (!(await requireAdmin(context))) return json({ error: "No autorizado" }, 403);
  const admin = createSupabaseAdmin();
  if (!admin) return json({ error: "Falta service role" }, 500);

  const { id, is_active } = await context.request.json();
  if (typeof id !== "string" || typeof is_active !== "boolean") {
    return json({ error: "Datos inválidos" }, 400);
  }

  const { error } = await admin.from("events").update({ is_active }).eq("id", id);
  if (error) return json({ error: error.message }, 500);
  return json({ success: true }, 200);
};

export const DELETE: APIRoute = async (context) => {
  if (!(await requireAdmin(context))) return json({ error: "No autorizado" }, 403);
  const admin = createSupabaseAdmin();
  if (!admin) return json({ error: "Falta service role" }, 500);

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
  if (error) return json({ error: error.message }, 500);
  return json({ success: true }, 200);
};
