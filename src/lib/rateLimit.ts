/**
 * Rate limit en memoria, por instancia de la función.
 *
 * Best-effort a propósito: con Fluid Compute las instancias viven y se
 * comparten entre requests, así que esto frena el spam simple (un script
 * martillando un form) sin sumar infraestructura. No es un límite global
 * exacto — un atacante distribuido lo supera — pero para formularios de un
 * portal barrial es la relación costo/beneficio correcta.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

// Barrido perezoso para que el Map no crezca sin límite
let lastSweep = 0;
function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

/**
 * true = dejar pasar; false = frenar (429).
 * `key` conviene que incluya el endpoint: `contacto:${ip}`.
 */
export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  sweep(now);

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  bucket.count += 1;
  return bucket.count <= max;
}

export const tooMany = () =>
  new Response(
    JSON.stringify({
      error: "rate_limited",
      message: "Demasiados intentos seguidos. Esperá un momento y probá de nuevo.",
    }),
    { status: 429, headers: { "Content-Type": "application/json" } },
  );
