import { useState } from "react";

type Props = {
  businessId: string;
  isFeatured: boolean;
  isApproved: boolean;
  /** Precio mensual en ARS (viene de MP_FEATURED_PRICE en el servidor). */
  price?: number;
};

export default function FeaturedCard({
  businessId,
  isFeatured,
  isApproved,
  price,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const subscribe = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId }),
      });
      const data = await res.json();

      if (res.ok && data.init_point) {
        window.location.href = data.init_point; // checkout de Mercado Pago
        return;
      }

      setMessage(
        data.message ??
          "Los pagos todavía no están habilitados. ¡Muy pronto! Mientras tanto escribinos desde el formulario de contacto.",
      );
    } catch {
      setMessage("Error de conexión, probá de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  if (isFeatured) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
        <p className="text-lg font-bold text-amber-700">
          ⭐ Tu negocio está destacado
        </p>
        <p className="mt-1 text-sm text-amber-600">
          Aparece primero en el listado y en la portada del sitio.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-6 space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-lg font-bold">⭐ Destacá tu negocio</p>
        {price != null && (
          <p className="text-sm font-semibold text-amber-700">
            ${price.toLocaleString("es-AR")}/mes
            <span className="ml-1 font-normal text-gray-400">
              · cancelás cuando quieras
            </span>
          </p>
        )}
      </div>
      <ul className="space-y-1 text-sm text-gray-600">
        <li>✓ Primero en el listado de negocios</li>
        <li>✓ En la portada de eltalar, que ven todos los vecinos</li>
        <li>✓ Galería de hasta 4 fotos en tu ficha (el gratuito incluye 1)</li>
        <li>✓ Insignia ⭐ en tu card y tu ficha</li>
        <li>✓ Marcador dorado en el mapa del barrio</li>
      </ul>

      {!isApproved ? (
        <p className="rounded-xl bg-gray-100 p-3 text-sm text-gray-500">
          Disponible cuando tu negocio esté aprobado y publicado.
        </p>
      ) : (
        <button
          onClick={subscribe}
          disabled={loading}
          className="w-full rounded-xl bg-amber-500 px-6 py-3 font-semibold text-white transition hover:bg-amber-600 disabled:opacity-60"
        >
          {loading ? "Preparando…" : "Destacar con Mercado Pago"}
        </button>
      )}

      {message && (
        <p className="rounded-xl bg-blue-50 p-3 text-sm text-blue-700">
          {message}
        </p>
      )}
    </div>
  );
}
