import type { APIRoute } from "astro";
import { createSupabaseServer } from "../../lib/supabase/server";
import { createSupabaseAdmin } from "../../lib/supabase/admin";

/**
 * Inicia la suscripción "Destacado" de un negocio vía Mercado Pago.
 *
 * Config necesaria (env vars en Vercel):
 *  - MP_ACCESS_TOKEN: access token de la cuenta de Mercado Pago
 *  - MP_FEATURED_PRICE: precio mensual en ARS (default 5000)
 *  - SUPABASE_SERVICE_ROLE_KEY: para registrar la suscripción
 */
export const POST: APIRoute = async (context) => {
  const mpToken = import.meta.env.MP_ACCESS_TOKEN;
  const admin = createSupabaseAdmin();

  if (!mpToken || !admin) {
    return new Response(
      JSON.stringify({
        error: "not_configured",
        message: "Los pagos todavía no están habilitados.",
      }),
      { status: 503 },
    );
  }

  const supabase = createSupabaseServer(context);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
    });
  }

  const { businessId } = await context.request.json();

  // Verifica que el negocio sea del usuario (vía RLS del cliente de sesión)
  const { data: business } = await supabase
    .from("businesses")
    .select("id, name, owner_id, status")
    .eq("id", businessId)
    .single();

  if (!business || business.owner_id !== user.id) {
    return new Response(
      JSON.stringify({
        error: "forbidden",
        message:
          "Solo el dueño del negocio puede destacarlo: entrá con la cuenta que tiene asignado este negocio.",
      }),
      { status: 403 },
    );
  }

  if (business.status !== "approved") {
    return new Response(
      JSON.stringify({
        error: "not_approved",
        message: "El negocio tiene que estar aprobado antes de destacarse.",
      }),
      { status: 400 },
    );
  }

  const price = Number(import.meta.env.MP_FEATURED_PRICE ?? 6500);
  // MP exige un back_url https público: en dev (localhost) usamos el dominio
  // real del sitio; el redirect post-pago cae en producción, no afecta el test.
  const origin = context.url.origin.includes("localhost")
    ? (import.meta.env.SITE ?? "https://eltalar.com.ar")
    : context.url.origin;

  // Crea la suscripción (preapproval) en Mercado Pago
  const mpRes = await fetch("https://api.mercadopago.com/preapproval", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${mpToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      reason: `El Talar - Negocio destacado: ${business.name}`,
      external_reference: business.id,
      // En sandbox (token TEST-) el pagador debe ser una cuenta de prueba de
      // MP; MP_TEST_PAYER_EMAIL la pisa. En producción no se define y se usa
      // el email real del comerciante.
      payer_email: import.meta.env.MP_TEST_PAYER_EMAIL ?? user.email,
      back_url: `${origin}/app/negocios/${business.id}?pago=ok`,
      auto_recurring: {
        frequency: 1,
        frequency_type: "months",
        transaction_amount: price,
        currency_id: "ARS",
      },
    }),
  });

  if (!mpRes.ok) {
    console.error("MP preapproval error:", await mpRes.text());
    return new Response(
      JSON.stringify({
        error: "mp_error",
        message:
          "Mercado Pago rechazó la operación. Probá de nuevo en un rato; si sigue pasando escribinos desde el formulario de contacto.",
      }),
      { status: 502 },
    );
  }

  const preapproval = await mpRes.json();

  // Registra la suscripción (pendiente hasta que el webhook confirme)
  await admin.from("subscriptions").upsert(
    {
      business_id: business.id,
      provider: "mercadopago",
      external_id: preapproval.id,
      status: "pending",
    },
    { onConflict: "external_id" },
  );

  return new Response(JSON.stringify({ init_point: preapproval.init_point }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
