import { useState } from "react";
import { supabaseBrowser } from "../../lib/supabase/browser";
import {
  classifiedCategory,
  formatPriceText,
} from "../../lib/repositories/classified.repository";

type MyClassified = {
  id: string;
  category: string;
  title: string;
  price_text: string | null;
  photo_url: string | null;
  status: string;
  published_at: string | null;
  expires_at: string;
  created_at: string;
};

type Props = {
  classifieds: MyClassified[];
};

const STATUS: Record<string, { label: string; bg: string; fg: string }> = {
  pending: { label: "En revisión", bg: "#fff7e6", fg: "#a5761a" },
  published: { label: "Publicado", bg: "#e7f6ec", fg: "#0b7a3f" },
  rejected: { label: "No publicado", bg: "#f7eceb", fg: "#c0463a" },
  expired: { label: "Vencido", bg: "#f4f5f2", fg: "#4a564d" },
};

/**
 * "Mis avisos": el vecino ve el estado de lo que publicó y puede editarlo o
 * borrarlo. La RLS ya limita todo a los avisos propios.
 */
export default function MyClassifieds({ classifieds }: Props) {
  const [items, setItems] = useState(classifieds);
  const [busy, setBusy] = useState<string | null>(null);
  // Borrar no tiene vuelta: se pide un segundo click en vez de un confirm()
  const [confirming, setConfirming] = useState<string | null>(null);

  const remove = async (aviso: MyClassified) => {
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
      alert(error.message ?? "No pudimos borrar el aviso");
    } else {
      // La foto se va con el aviso: si no, queda ocupando storage sin dueño
      const path = aviso.photo_url?.split("/classified-photos/")[1];
      if (path) {
        await supabaseBrowser.storage.from("classified-photos").remove([path]);
      }
      setItems((prev) => prev.filter((c) => c.id !== aviso.id));
    }

    setBusy(null);
  };

  if (items.length === 0) {
    return (
      <div className="rounded-[20px] bg-bg-card p-8 text-center shadow-soft">
        <h2 className="mb-2 text-[19px] font-extrabold text-text-main">
          Todavía no publicaste ningún aviso
        </h2>
        <p className="mx-auto mb-5 max-w-md text-[14px] text-text-body">
          Si tenés algo para vender, ofrecer o pedir, los vecinos lo van a ver
          acá.
        </p>
        <a
          href="/avisos/nuevo"
          className="inline-block rounded-[14px] bg-primary px-6 py-3.5 text-[15px] font-semibold text-white"
        >
          Publicar un aviso
        </a>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {items.map((aviso) => {
        const category = classifiedCategory(aviso.category);
        const status = STATUS[aviso.status] ?? STATUS.pending;
        return (
          <div
            key={aviso.id}
            className={`flex flex-wrap items-center gap-4 rounded-[18px] bg-bg-card p-4 shadow-soft ${
              busy === aviso.id ? "opacity-50" : ""
            }`}
          >
            {aviso.photo_url ? (
              <img
                src={aviso.photo_url}
                alt=""
                className="size-16 shrink-0 rounded-xl object-cover"
              />
            ) : (
              <div className="img-placeholder size-16 shrink-0 rounded-xl" />
            )}

            <div className="min-w-[180px] flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="rounded-full px-2 py-[3px] text-[10.5px] font-bold"
                  style={{ background: category.bg, color: category.fg }}
                >
                  {category.label}
                </span>
                <span
                  className="rounded-full px-2 py-[3px] text-[10.5px] font-bold"
                  style={{ background: status.bg, color: status.fg }}
                >
                  {status.label}
                </span>
              </div>

              <div className="mt-1 text-[15.5px] font-bold text-text-main">
                {aviso.title}
              </div>

              <div className="text-[12.5px] text-text-muted">
                {aviso.price_text ? `${formatPriceText(aviso.price_text)} · ` : ""}
                {aviso.status === "published"
                  ? `vence el ${new Date(aviso.expires_at).toLocaleDateString("es-AR")}`
                  : `cargado el ${new Date(aviso.created_at).toLocaleDateString("es-AR")}`}
              </div>
            </div>

            <div className="flex gap-2">
              <a
                href={`/avisos/mios/${aviso.id}`}
                className="rounded-xl bg-primary-faint px-4 py-2.5 text-[13px] font-semibold text-text-main transition-colors hover:bg-primary-soft"
              >
                Editar
              </a>
              <button
                type="button"
                onClick={() => remove(aviso)}
                disabled={busy === aviso.id}
                className={`rounded-xl px-4 py-2.5 text-[13px] font-semibold transition-colors ${
                  confirming === aviso.id
                    ? "bg-error text-white"
                    : "border border-[rgba(192,70,58,.3)] text-error"
                }`}
              >
                {confirming === aviso.id ? "Confirmar" : "Borrar"}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
