import { useEffect, useRef, useState } from "react";
import { Star } from "lucide-react";
import { supabaseBrowser } from "../../lib/supabase/browser";

type Review = {
  id: string;
  business_id: string;
  author_name: string;
  rating: number;
  comment: string | null;
  status: string;
  created_at: string;
  businesses: { name: string; slug: string } | null;
};

type Props = {
  pending: Review[];
  published: Review[];
  rejected: Review[];
};

type Tab = "pending" | "published" | "rejected";

/**
 * Moderación de reseñas: cola de pendientes + las ya publicadas, que el
 * admin puede despublicar o borrar (una reseña que se pasa de la raya no
 * puede quedar viva porque ya se aprobó). El promedio del negocio lo
 * recalcula el trigger de la tabla en cada cambio.
 * Las rechazadas quedan en su tab: un rechazo por error se deshace con
 * "Publicar".
 */
export default function ReviewsManager({ pending, published, rejected }: Props) {
  const [tab, setTab] = useState<Tab>("pending");
  const [items, setItems] = useState({ pending, published, rejected });
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Borrar es irreversible: se pide un segundo click en vez de un confirm()
  const [confirming, setConfirming] = useState<string | null>(null);
  // La confirmación se desarma sola a los ~4s si no se concreta
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  useEffect(() => () => clearTimeout(confirmTimer.current), []);

  const cancelConfirm = () => {
    clearTimeout(confirmTimer.current);
    setConfirming(null);
  };

  const setStatus = async (review: Review, status: string) => {
    setBusy(review.id);
    setError(null);

    const { error: updateError } = await supabaseBrowser
      .from("reviews")
      .update({ status })
      .eq("id", review.id);

    if (updateError) {
      console.error(updateError);
      setError(updateError.message ?? "Error moderando la reseña");
    } else {
      const updated = { ...review, status };
      setItems((prev) => ({
        pending: prev.pending.filter((r) => r.id !== review.id),
        published:
          status === "published"
            ? [updated, ...prev.published.filter((r) => r.id !== review.id)]
            : prev.published.filter((r) => r.id !== review.id),
        rejected:
          status === "rejected"
            ? [updated, ...prev.rejected.filter((r) => r.id !== review.id)]
            : prev.rejected.filter((r) => r.id !== review.id),
      }));
    }

    setBusy(null);
  };

  const remove = async (review: Review) => {
    if (confirming !== review.id) {
      clearTimeout(confirmTimer.current);
      setConfirming(review.id);
      confirmTimer.current = setTimeout(() => setConfirming(null), 4000);
      return;
    }

    setBusy(review.id);
    setError(null);
    cancelConfirm();

    const { error: deleteError } = await supabaseBrowser
      .from("reviews")
      .delete()
      .eq("id", review.id);

    if (deleteError) {
      console.error(deleteError);
      setError(deleteError.message ?? "Error borrando la reseña");
    } else {
      setItems((prev) => ({
        pending: prev.pending.filter((r) => r.id !== review.id),
        published: prev.published.filter((r) => r.id !== review.id),
        rejected: prev.rejected.filter((r) => r.id !== review.id),
      }));
    }

    setBusy(null);
  };

  const list = items[tab];

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(
          [
            ["pending", `Pendientes (${items.pending.length})`],
            ["published", `Publicadas (${items.published.length})`],
            ["rejected", `Rechazadas (${items.rejected.length})`],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold ${
              tab === value
                ? "bg-gray-900 text-white"
                : "border border-gray-300 text-gray-600"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      {list.length === 0 ? (
        <p className="rounded-2xl bg-gray-50 p-5 text-sm text-gray-500">
          {tab === "pending"
            ? "No hay reseñas pendientes."
            : tab === "published"
              ? "Todavía no hay reseñas publicadas."
              : "No hay reseñas rechazadas."}
        </p>
      ) : (
        <ul className="space-y-2">
          {list.map((review) => (
            <li
              key={review.id}
              className={`space-y-2 rounded-2xl bg-white p-4 shadow-sm ${
                busy === review.id ? "opacity-50" : ""
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">
                    {review.businesses ? (
                      <a
                        href={`/negocios/${review.businesses.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:underline"
                      >
                        {review.businesses.name}
                      </a>
                    ) : (
                      "(negocio borrado)"
                    )}
                  </p>
                  <p className="flex items-center gap-1.5 text-xs text-gray-500">
                    <span className="flex">
                      {[1, 2, 3, 4, 5].map((value) => (
                        <Star
                          key={value}
                          size={12}
                          className={
                            value <= review.rating
                              ? "fill-amber-400 text-amber-400"
                              : "text-gray-300"
                          }
                        />
                      ))}
                    </span>
                    {review.author_name} ·{" "}
                    {new Date(review.created_at).toLocaleDateString("es-AR")}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {tab === "pending" ? (
                    <>
                      <button
                        onClick={() => setStatus(review, "published")}
                        disabled={busy === review.id}
                        className="rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-white"
                      >
                        Publicar
                      </button>
                      <button
                        onClick={() => setStatus(review, "rejected")}
                        disabled={busy === review.id}
                        className="rounded-full border border-gray-300 px-4 py-1.5 text-sm text-gray-600"
                      >
                        Rechazar
                      </button>
                    </>
                  ) : tab === "published" ? (
                    <button
                      onClick={() => setStatus(review, "rejected")}
                      disabled={busy === review.id}
                      className="rounded-full border border-gray-300 px-4 py-1.5 text-sm text-gray-600"
                    >
                      Despublicar
                    </button>
                  ) : (
                    // Deshacer un rechazo (o volver a publicar una bajada)
                    <button
                      onClick={() => setStatus(review, "published")}
                      disabled={busy === review.id}
                      className="rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-white"
                    >
                      Publicar
                    </button>
                  )}

                  <button
                    onClick={() => remove(review)}
                    disabled={busy === review.id}
                    className={`rounded-full px-4 py-1.5 text-sm font-semibold ${
                      confirming === review.id
                        ? "bg-red-600 text-white"
                        : "border border-red-200 text-red-600"
                    }`}
                  >
                    {confirming === review.id ? "Confirmar borrado" : "Borrar"}
                  </button>
                  {confirming === review.id && (
                    <button
                      onClick={cancelConfirm}
                      disabled={busy === review.id}
                      className="rounded-full border border-gray-300 px-4 py-1.5 text-sm text-gray-600"
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              </div>

              {review.comment && (
                <p className="whitespace-pre-line text-sm text-gray-700">
                  {review.comment}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
