import { useState } from "react";
import { supabaseBrowser } from "../../lib/supabase/browser";
import { classifiedCategory } from "../../lib/repositories/classified.repository";

type Classified = {
  id: string;
  category: string;
  title: string;
  description: string | null;
  price_text: string | null;
  whatsapp: string | null;
  author_name: string;
  status: string;
  created_at: string;
};

type Props = {
  classifieds: Classified[];
};

/**
 * Cola de moderación de los avisos de vecinos. Publicar sella published_at
 * y reinicia los 30 días de vigencia desde la aprobación, no desde que el
 * vecino lo cargó.
 */
export default function ClassifiedsManager({ classifieds }: Props) {
  const [items, setItems] = useState(classifieds);
  const [busy, setBusy] = useState<string | null>(null);

  const resolve = async (id: string, approve: boolean) => {
    setBusy(id);

    const now = new Date();
    const expires = new Date(now.getTime() + 30 * 86_400_000);

    const { error } = await supabaseBrowser
      .from("classifieds")
      .update(
        approve
          ? {
              status: "published",
              published_at: now.toISOString(),
              expires_at: expires.toISOString(),
            }
          : { status: "rejected" },
      )
      .eq("id", id);

    if (error) {
      console.error(error);
      alert(error.message ?? "Error moderando el aviso");
    } else {
      setItems((prev) => prev.filter((c) => c.id !== id));
    }

    setBusy(null);
  };

  if (items.length === 0) {
    return (
      <p className="rounded-2xl bg-gray-50 p-5 text-sm text-gray-500">
        No hay avisos pendientes.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {items.map((aviso) => {
        const category = classifiedCategory(aviso.category);
        return (
          <li
            key={aviso.id}
            className={`space-y-2 rounded-2xl bg-white p-4 shadow-sm ${
              busy === aviso.id ? "opacity-50" : ""
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="flex items-center gap-2 font-semibold">
                  <span
                    className="rounded-full px-2 py-0.5 text-[11px] font-bold"
                    style={{ background: category.bg, color: category.fg }}
                  >
                    {category.label}
                  </span>
                  {aviso.title}
                </p>
                <p className="text-xs text-gray-500">
                  {aviso.author_name}
                  {aviso.price_text ? ` · ${aviso.price_text}` : ""}
                  {aviso.whatsapp ? ` · ${aviso.whatsapp}` : ""} ·{" "}
                  {new Date(aviso.created_at).toLocaleDateString("es-AR")}
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => resolve(aviso.id, true)}
                  disabled={busy === aviso.id}
                  className="rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-white"
                >
                  Publicar
                </button>
                <button
                  onClick={() => resolve(aviso.id, false)}
                  disabled={busy === aviso.id}
                  className="rounded-full border border-gray-300 px-4 py-1.5 text-sm text-gray-600"
                >
                  Rechazar
                </button>
              </div>
            </div>

            {aviso.description && (
              <p className="whitespace-pre-line text-sm text-gray-700">
                {aviso.description}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
