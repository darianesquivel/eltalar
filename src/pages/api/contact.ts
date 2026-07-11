import type { APIRoute } from "astro";
import { supabase } from "../../lib/supabase";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const json = (body: object, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { name, email, message, company } = body;

    // Honeypot: el campo "company" está oculto en el form; solo lo completan
    // los bots. Respondemos éxito falso para no darles señal de que fallaron.
    if (company) {
      return json({ success: true }, 200);
    }

    if (
      typeof name !== "string" ||
      typeof email !== "string" ||
      typeof message !== "string" ||
      !name.trim() ||
      !email.trim() ||
      !message.trim()
    ) {
      return json({ error: "Datos incompletos" }, 400);
    }

    if (name.length > 100 || email.length > 200 || message.length > 2000) {
      return json({ error: "Mensaje demasiado largo" }, 400);
    }

    if (!EMAIL_RE.test(email)) {
      return json({ error: "Email inválido" }, 400);
    }

    const { error } = await supabase.from("contact_messages").insert({
      name: name.trim(),
      email: email.trim(),
      message: message.trim(),
    });

    if (error) {
      console.error(error);
      return json({ error: "Error guardando mensaje" }, 500);
    }

    return json({ success: true }, 200);
  } catch (err) {
    console.error(err);
    return json({ error: "Error inesperado" }, 500);
  }
};
