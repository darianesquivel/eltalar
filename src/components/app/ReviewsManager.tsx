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
  reviews: Review[];
};

/**
 * Cola de moderación de reseñas: se publican recién cuando un admin las
 * aprueba. La escritura va por el cliente de sesión — la policy de admin
 * de la tabla reviews es la que autoriza.
 */
export default function ReviewsManager({ reviews }: Props) {
  const [items, setItems] = useState(reviews);
  const [busy, setBusy] = useState<string | null>(null);

  const resolve = async (id: string, approve: boolean) => {
    setBusy(id);

    const { error } = await supabaseBrowser
      .from("reviews")
      .update({ status: approve ? "published" : "rejected" })
      .eq("id", id);

    if (error) {
      console.error(error);
      alert(error.message ?? "Error moderando la reseña");
    } else {
      setItems((prev) => prev.filter((r) => r.id !== id));
    }

    setBusy(null);
  };

  if (items.length === 0) {
    return (
      <p className="rounded-2xl bg-gray-50 p-5 text-sm text-gray-500">
        No hay reseñas pendientes.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {items.map((review) => (
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

            <div className="flex gap-2">
              <button
                onClick={() => resolve(review.id, true)}
                disabled={busy === review.id}
                className="rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-white"
              >
                Publicar
              </button>
              <button
                onClick={() => resolve(review.id, false)}
                disabled={busy === review.id}
                className="rounded-full border border-gray-300 px-4 py-1.5 text-sm text-gray-600"
              >
                Rechazar
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
  );
}
