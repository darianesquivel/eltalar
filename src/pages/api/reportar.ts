import type { APIRoute } from "astro";
import { supabase } from "../../lib/supabase";

const MOTIVOS = [
  "Cerró definitivamente",
  "No existe o nunca existió",
  "Datos incorrectos (teléfono, horarios, dirección)",
  "Está repetido",
  "Otro",
];

const json = (body: object, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

/**
 * Reporte de errores en una ficha de negocio (público, sin login).
 * Se guarda como mensaje en contact_messages: el admin los ve en la misma
 * bandeja de /app/admin/mensajes, prefijados con [REPORTE].
 */
export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { slug, businessName, motivo, detalle, email, company } = body;

    // Honeypot: campo oculto que solo completan los bots
    if (company) {
      return json({ success: true }, 200);
    }

    if (
      typeof slug !== "string" ||
      typeof businessName !== "string" ||
      !slug.trim() ||
      !businessName.trim() ||
      !MOTIVOS.includes(motivo)
    ) {
      return json({ error: "Datos incompletos" }, 400);
    }

    if ((detalle && detalle.length > 1000) || (email && email.length > 200)) {
      return json({ error: "Mensaje demasiado largo" }, 400);
    }

    const message = [
      `[REPORTE] ${businessName.trim().slice(0, 120)}`,
      `Ficha: https://eltalar.com.ar/negocios/${slug.trim().slice(0, 120)}`,
      `Motivo: ${motivo}`,
      detalle?.trim() ? `Detalle: ${detalle.trim()}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    const { error } = await supabase.from("contact_messages").insert({
      name: "Reporte de ficha",
      email: email?.trim() || "sin-email@eltalar.com.ar",
      message,
    });

    if (error) {
      console.error(error);
      return json({ error: "Error guardando el reporte" }, 500);
    }

    return json({ success: true }, 200);
  } catch (err) {
    console.error(err);
    return json({ error: "Error inesperado" }, 500);
  }
};
