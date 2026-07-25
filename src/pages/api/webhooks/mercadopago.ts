import type { APIRoute } from "astro";
import { createHmac, timingSafeEqual } from "node:crypto";
import { createSupabaseAdmin } from "../../../lib/supabase/admin";

/**
 * Webhook de Mercado Pago para suscripciones (preapproval).
 * Configurar en MP: URL = https://<dominio>/api/webhooks/mercadopago
 *
 * MP notifica un evento con el ID del preapproval; acá lo consultamos a la
 * API (fuente de verdad) y actualizamos la suscripción + el negocio.
 *
 * Env vars:
 *  - MP_ACCESS_TOKEN: access token de la cuenta de Mercado Pago
 *  - MP_WEBHOOK_SECRET: la "clave secreta" del panel de webhooks de MP.
 *    Con ella se verifica la firma x-signature: sin verificar, cualquiera
 *    puede postear ids inventados y hacernos gastar llamadas a la API de MP.
 */

const FEATURED_DAYS = 35; // fallback: un mes + margen

/**
 * Verifica la firma HMAC de MP (header x-signature: "ts=...,v1=...").
 * El manifest firmado es `id:{data.id};request-id:{x-request-id};ts:{ts};`
 * según la documentación oficial de notificaciones.
 */
function isValidSignature(
  request: Request,
  dataId: string,
  secret: string,
): boolean {
  const xSignature = request.headers.get("x-signature") ?? "";
  const xRequestId = request.headers.get("x-request-id") ?? "";

  const parts: Record<string, string> = {};
  for (const piece of xSignature.split(",")) {
    const [key, ...rest] = piece.split("=");
    if (key && rest.length) parts[key.trim()] = rest.join("=").trim();
  }
  const { ts, v1 } = parts;
  if (!ts || !v1) return false;

  // MP pide el data.id en minúsculas para armar el manifest
  const manifest = `id:${dataId.toLowerCase()};request-id:${xRequestId};ts:${ts};`;
  const expected = createHmac("sha256", secret).update(manifest).digest("hex");

  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(v1));
  } catch {
    return false; // largos distintos
  }
}

export const POST: APIRoute = async ({ request }) => {
  const mpToken = import.meta.env.MP_ACCESS_TOKEN;
  const admin = createSupabaseAdmin();

  // Sin config, respondemos 200 igual para que MP no reintente infinito
  if (!mpToken || !admin) {
    return new Response("not configured", { status: 200 });
  }

  let preapprovalId: string | null = null;

  const url = new URL(request.url);
  // MP manda el id por query (?id= / ?data.id=) o en el body JSON
  const queryDataId =
    url.searchParams.get("data.id") ?? url.searchParams.get("id");
  preapprovalId = queryDataId;

  if (!preapprovalId) {
    const body = await request.json().catch(() => null);
    preapprovalId = body?.data?.id ?? body?.id ?? null;
  }

  if (!preapprovalId) {
    return new Response("no id", { status: 200 });
  }

  // La firma cubre el data.id de la query; se verifica solo si el secret
  // está configurado (para no romper el sandbox si todavía no se cargó).
  const secret = import.meta.env.MP_WEBHOOK_SECRET;
  if (secret && !isValidSignature(request, queryDataId ?? preapprovalId, secret)) {
    console.error("MP webhook: firma inválida");
    return new Response("invalid signature", { status: 403 });
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

  if (!businessId) {
    // Sin referencia al negocio no hay nada que actualizar; 200 para que
    // MP no reintente algo que nunca va a poder procesarse.
    console.error("MP webhook: preapproval sin external_reference");
    return new Response("no reference", { status: 200 });
  }

  const STATUS_MAP: Record<string, string> = {
    pending: "pending",
    authorized: "active",
    paused: "paused",
    cancelled: "cancelled",
  };
  const status = STATUS_MAP[preapproval.status] ?? "pending";

  // Hasta cuándo vale el período pagado: la fecha real del próximo cobro
  // que informa MP; si no vino, un mes + margen desde ahora.
  const nextPayment = Date.parse(preapproval.next_payment_date ?? "");
  const periodEnd = new Date(
    Number.isFinite(nextPayment) && nextPayment > Date.now()
      ? nextPayment
      : Date.now() + FEATURED_DAYS * 86400000,
  ).toISOString();

  const { error: subError } = await admin.from("subscriptions").upsert(
    {
      business_id: businessId,
      provider: "mercadopago",
      external_id: preapprovalId,
      status,
      // Solo se pisa cuando hay un período pagado nuevo: al cancelar se
      // conserva la fecha del último período (hasta cuándo tiene beneficio)
      ...(status === "active" && { current_period_end: periodEnd }),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "external_id" },
  );

  // Un pago real que no pudo persistirse NO puede devolver 200: con 500,
  // Mercado Pago reintenta la notificación más tarde.
  if (subError) {
    console.error("MP webhook: error guardando subscription:", subError);
    return new Response("db error", { status: 500 });
  }

  if (status === "active") {
    const { error: bizError } = await admin
      .from("businesses")
      .update({
        is_featured: true,
        plan: "destacado",
        featured_until: periodEnd,
      })
      .eq("id", businessId);

    if (bizError) {
      console.error("MP webhook: error destacando negocio:", bizError);
      return new Response("db error", { status: 500 });
    }
  }
  // cancelled/paused: NO se apaga el destacado acá — el comerciante ya pagó
  // el período vigente y lo conserva hasta featured_until. El job diario de
  // la base (docs/sql/2026-07-12-expirar-destacados.sql) apaga los vencidos.

  return new Response("ok", { status: 200 });
};
