import type { APIRoute } from "astro";
import { supabaseClient } from "../../lib/supabaseClient";

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { name, email, message } = body;

    if (!name || !email || !message) {
      return new Response(JSON.stringify({ error: "Datos incompletos" }), {
        status: 400,
      });
    }

    const { error } = await supabaseClient.from("contact_messages").insert({
      name,
      email,
      message,
    });

    if (error) {
      console.error(error);
      return new Response(
        JSON.stringify({ error: "Error guardando mensaje" }),
        { status: 500 }
      );
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: "Error inesperado" }), {
      status: 500,
    });
  }
};
