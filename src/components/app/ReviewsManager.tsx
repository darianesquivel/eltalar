import { useState } from "react";
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
};

/**
 * Moderación de reseñas: cola de pendientes + las ya publicadas, que el
 * admin puede despublicar o borrar (una reseña que se pasa de la raya no
 * puede quedar viva porque ya se aprobó). El promedio del negocio lo
 * recalcula el trigger de la tabla en cada cambio.
 */
export default function ReviewsManager({ pending, published }: Props) {
  const [tab, setTab] = useState<"pending" | "published">("pending");
  const [items, setItems] = useState({ pending, published });
  const [busy, setBusy] = useState<string | null>(null);
  // Borrar es irreversible: se pide un segundo click en vez de un confirm()
  const [confirming, setConfirming] = useState<string | null>(null);

  const setStatus = async (review: Review, status: string) => {
    setBusy(review.id);

    const { error } = await supabaseBrowser
      .from("reviews")
      .update({ status })
      .eq("id", review.id);

    if (error) {
      console.error(error);
      alert(error.message ?? "Error moderando la reseña");
    } else {
      setItems((prev) => ({
        pending: prev.pending.filter((r) => r.id !== review.id),
        published:
          status === "published"
            ? [{ ...review, status }, ...prev.published]
            : prev.published.filter((r) => r.id !== review.id),
      }));
    }

    setBusy(null);
  };

  const remove = async (review: Review) => {
    if (confirming !== review.id) {
      setConfirming(review.id);
      return;
    }

    setBusy(review.id);
    setConfirming(null);

    const { error } = await supabaseBrowser
      .from("reviews")
      .delete()
      .eq("id", review.id);

    if (error) {
      console.error(error);
      alert(error.message ?? "Error borrando la reseña");
    } else {
      setItems((prev) => ({
        pending: prev.pending.filter((r) => r.id !== review.id),
        published: prev.published.filter((r) => r.id !== review.id),
      }));
    }

    setBusy(null);
  };

  const list = tab === "pending" ? items.pending : items.published;

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(
          [
            ["pending", `Pendientes (${items.pending.length})`],
            ["published", `Publicadas (${items.published.length})`],
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

      {list.length === 0 ? (
        <p className="rounded-2xl bg-gray-50 p-5 text-sm text-gray-500">
          {tab === "pending"
            ? "No hay reseñas pendientes."
            : "Todavía no hay reseñas publicadas."}
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
                  ) : (
                    <button
                      onClick={() => setStatus(review, "rejected")}
                      disabled={busy === review.id}
                      className="rounded-full border border-gray-300 px-4 py-1.5 text-sm text-gray-600"
                    >
                      Despublicar
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
