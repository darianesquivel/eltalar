import type { APIRoute } from "astro";
import { createSupabaseAdmin } from "../../../lib/supabase/admin";

/**
 * Webhook de Mercado Pago para suscripciones (preapproval).
 * Configurar en MP: URL = https://<dominio>/api/webhooks/mercadopago
 *
 * MP notifica un evento con el ID del preapproval; acá lo consultamos a la
 * API (fuente de verdad) y actualizamos la suscripción + el negocio.
 */

const FEATURED_DAYS = 35; // un mes + margen

export const POST: APIRoute = async ({ request }) => {
  const mpToken = import.meta.env.MP_ACCESS_TOKEN;
  const admin = createSupabaseAdmin();

  // Sin config, respondemos 200 igual para que MP no reintente infinito
  if (!mpToken || !admin) {
    return new Response("not configured", { status: 200 });
  }

  let preapprovalId: string | null = null;

  try {
    const url = new URL(request.url);
    // MP manda el id por query (?id= / ?data.id=) o en el body JSON
    preapprovalId =
      url.searchParams.get("data.id") ?? url.searchParams.get("id");

    if (!preapprovalId) {
      const body = await request.json().catch(() => null);
      preapprovalId = body?.data?.id ?? body?.id ?? null;
    }
  } catch {
    /* body vacío */
  }

  if (!preapprovalId) {
    return new Response("no id", { status: 200 });
  }

  const mpHeaders = { Authorization: `Bearer ${mpToken}` };

  // Consulta el estado real a Mercado Pago. Según el topic, data.id puede ser:
  //  - subscription_preapproval → el id de la SUSCRIPCIÓN (directo)
  //  - subscription_authorized_payment → el id del COBRO mensual: hay que
  //    consultar /authorized_payments/{id} para llegar al preapproval_id.
  //    (Esto era lo que faltaba: el aviso del pago se descartaba y el
  //    negocio no se destacaba solo.)
  let mpRes = await fetch(
    `https://api.mercadopago.com/preapproval/${preapprovalId}`,
    { headers: mpHeaders },
  );

  if (!mpRes.ok) {
    const payRes = await fetch(
      `https://api.mercadopago.com/authorized_payments/${preapprovalId}`,
      { headers: mpHeaders },
    );
    if (payRes.ok) {
      const payment = await payRes.json();
      if (payment?.preapproval_id) {
        preapprovalId = String(payment.preapproval_id);
        mpRes = await fetch(
          `https://api.mercadopago.com/preapproval/${preapprovalId}`,
          { headers: mpHeaders },
        );
      }
    }
  }

  if (!mpRes.ok) {
    console.error("MP fetch preapproval error:", mpRes.status);
    return new Response("mp error", { status: 200 });
  }

  const preapproval = await mpRes.json();
  const businessId: string | undefined = preapproval.external_reference;

  const STATUS_MAP: Record<string, string> = {
    pending: "pending",
    authorized: "active",
    paused: "paused",
    cancelled: "cancelled",
  };
  const status = STATUS_MAP[preapproval.status] ?? "pending";

  await admin.from("subscriptions").upsert(
    {
      business_id: businessId!,
      provider: "mercadopago",
      external_id: preapprovalId,
      status,
      // Solo se pisa cuando hay un período pagado nuevo: al cancelar se
      // conserva la fecha del último período (hasta cuándo tiene beneficio)
      ...(status === "active" && {
        current_period_end: new Date(
          Date.now() + FEATURED_DAYS * 86400000,
        ).toISOString(),
      }),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "external_id" },
  );

  if (businessId && status === "active") {
    await admin
      .from("businesses")
      .update({
        is_featured: true,
        plan: "destacado",
        featured_until: new Date(
          Date.now() + FEATURED_DAYS * 86400000,
        ).toISOString(),
      })
      .eq("id", businessId);
  }
  // cancelled/paused: NO se apaga el destacado acá — el comerciante ya pagó
  // el período vigente y lo conserva hasta featured_until. El job diario de
  // la base (docs/sql/2026-07-12-expirar-destacados.sql) apaga los vencidos.

  return new Response("ok", { status: 200 });
};
