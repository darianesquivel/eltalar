import { useState } from "react";
import { supabaseBrowser } from "../../lib/supabase/browser";
import {
  classifiedCategory,
  formatPriceText,
} from "../../lib/repositories/classified.repository";

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
  expires_at: string;
};

type Props = {
  pending: Classified[];
  published: Classified[];
};

const DAYS_30 = 30 * 86_400_000;

/**
 * Moderación de avisos: cola de pendientes + los publicados, que el admin
 * puede bajar o borrar en cualquier momento (un aviso que se pasa de la
 * raya no puede quedar vivo porque ya se aprobó).
 * Publicar reinicia los 30 días desde la aprobación.
 */
export default function ClassifiedsManager({ pending, published }: Props) {
  const [tab, setTab] = useState<"pending" | "published">("pending");
  const [items, setItems] = useState({ pending, published });
  const [busy, setBusy] = useState<string | null>(null);
  // Borrar es irreversible: se pide un segundo click en vez de un confirm()
  const [confirming, setConfirming] = useState<string | null>(null);

  const setStatus = async (aviso: Classified, publish: boolean) => {
    setBusy(aviso.id);

    const now = new Date();
    const patch = publish
      ? {
          status: "published",
          published_at: now.toISOString(),
          expires_at: new Date(now.getTime() + DAYS_30).toISOString(),
        }
      : { status: "rejected" };

    const { error } = await supabaseBrowser
      .from("classifieds")
      .update(patch)
      .eq("id", aviso.id);

    if (error) {
      console.error(error);
      alert(error.message ?? "Error moderando el aviso");
    } else {
      setItems((prev) => ({
        pending: prev.pending.filter((c) => c.id !== aviso.id),
        published: publish
          ? [{ ...aviso, ...patch }, ...prev.published]
          : prev.published.filter((c) => c.id !== aviso.id),
      }));
    }

    setBusy(null);
  };

  const remove = async (aviso: Classified) => {
    if (confirming !== aviso.id) {
      setConfirming(aviso.id);
      return;
    }

    setBusy(aviso.id);
    setConfirming(null);

    const { error } = await supabaseBrowser
      .from("classifieds")
      .delete()
      .eq("id", aviso.id);

    if (error) {
      console.error(error);
      alert(error.message ?? "Error borrando el aviso");
    } else {
      setItems((prev) => ({
        pending: prev.pending.filter((c) => c.id !== aviso.id),
        published: prev.published.filter((c) => c.id !== aviso.id),
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
            ["published", `Publicados (${items.published.length})`],
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
            ? "No hay avisos pendientes."
            : "Todavía no hay avisos publicados."}
        </p>
      ) : (
        <ul className="space-y-2">
          {list.map((aviso) => {
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
                      {aviso.price_text ? ` · ${formatPriceText(aviso.price_text)}` : ""}
                      {aviso.whatsapp ? ` · ${aviso.whatsapp}` : ""} ·{" "}
                      {tab === "published"
                        ? `vence ${new Date(aviso.expires_at).toLocaleDateString("es-AR")}`
                        : new Date(aviso.created_at).toLocaleDateString("es-AR")}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {tab === "pending" ? (
                      <>
                        <button
                          onClick={() => setStatus(aviso, true)}
                          disabled={busy === aviso.id}
                          className="rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-white"
                        >
                          Publicar
                        </button>
                        <button
                          onClick={() => setStatus(aviso, false)}
                          disabled={busy === aviso.id}
                          className="rounded-full border border-gray-300 px-4 py-1.5 text-sm text-gray-600"
                        >
                          Rechazar
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setStatus(aviso, false)}
                        disabled={busy === aviso.id}
                        className="rounded-full border border-gray-300 px-4 py-1.5 text-sm text-gray-600"
                      >
                        Bajar del sitio
                      </button>
                    )}

                    <button
                      onClick={() => remove(aviso)}
                      disabled={busy === aviso.id}
                      className={`rounded-full px-4 py-1.5 text-sm font-semibold ${
                        confirming === aviso.id
                          ? "bg-red-600 text-white"
                          : "border border-red-200 text-red-600"
                      }`}
                    >
                      {confirming === aviso.id ? "Confirmar borrado" : "Borrar"}
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
      )}
    </div>
  );
}
