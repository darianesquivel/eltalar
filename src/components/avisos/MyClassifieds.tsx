import { useEffect, useRef, useState } from "react";
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

/** Los avisos vencidos se borran solos una semana después (cron diario). */
const GRACE_DAYS = 7;

const fecha = (iso: string) => new Date(iso).toLocaleDateString("es-AR");

const seBorraEl = (expiresAt: string) =>
  new Date(
    new Date(expiresAt).getTime() + GRACE_DAYS * 86_400_000,
  ).toISOString();

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
  // Errores de renovar/borrar, mostrados al lado de la card afectada
  const [errorDe, setErrorDe] = useState<{
    id: string;
    mensaje: string;
  } | null>(null);
  // Feedback breve después de renovar
  const [renovado, setRenovado] = useState<string | null>(null);

  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const renovadoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
      if (renovadoTimer.current) clearTimeout(renovadoTimer.current);
    },
    [],
  );

  const cancelarConfirmacion = () => {
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
    setConfirming(null);
  };

  // Renovar no pasa por moderación: no cambia el contenido, solo estira la
  // fecha. Por eso va por la función renovar_aviso y no por un update.
  const renew = async (aviso: MyClassified) => {
    setBusy(aviso.id);
    setErrorDe(null);

    const { data, error } = await supabaseBrowser.rpc("renovar_aviso", {
      p_id: aviso.id,
    });

    if (error) {
      console.error(error);
      setErrorDe({
        id: aviso.id,
        mensaje: error.message ?? "No pudimos renovar el aviso",
      });
    } else {
      setItems((prev) =>
        prev.map((c) =>
          c.id === aviso.id
            ? { ...c, status: "published", expires_at: data as string }
            : c,
        ),
      );
      setRenovado(aviso.id);
      if (renovadoTimer.current) clearTimeout(renovadoTimer.current);
      renovadoTimer.current = setTimeout(() => setRenovado(null), 4000);
    }

    setBusy(null);
  };

  const remove = async (aviso: MyClassified) => {
    if (confirming !== aviso.id) {
      // El pedido de confirmación vence solo: nadie quiere un botón rojo
      // armado para siempre.
      setConfirming(aviso.id);
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
      confirmTimer.current = setTimeout(() => setConfirming(null), 4000);
      return;
    }

    setBusy(aviso.id);
    setErrorDe(null);
    cancelarConfirmacion();

    const { error } = await supabaseBrowser
      .from("classifieds")
      .delete()
      .eq("id", aviso.id);

    if (error) {
      console.error(error);
      setErrorDe({
        id: aviso.id,
        mensaje: error.message ?? "No pudimos borrar el aviso",
      });
    } else {
      // La foto se va con el aviso: si no, queda ocupando storage sin dueño.
      // La URL pública viene percent-encodeada: hay que decodificarla igual
      // que storagePath() en la API, o Storage no encuentra el objeto.
      const raw = aviso.photo_url?.split("/classified-photos/")[1];
      if (raw) {
        let path = raw;
        try {
          path = decodeURIComponent(raw);
        } catch {
          // Queda la ruta cruda: mejor intentar con algo que con nada
        }
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
                {aviso.price_text
                  ? `${formatPriceText(aviso.price_text)} · `
                  : ""}
                {aviso.status === "published"
                  ? `vence el ${fecha(aviso.expires_at)}`
                  : aviso.status === "expired"
                    ? `venció el ${fecha(aviso.expires_at)} · se borra el ${fecha(seBorraEl(aviso.expires_at))}`
                    : `cargado el ${fecha(aviso.created_at)}`}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {(aviso.status === "expired" || aviso.status === "published") && (
                <button
                  type="button"
                  onClick={() => renew(aviso)}
                  disabled={busy === aviso.id}
                  className="rounded-xl bg-primary px-4 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-primary-hover"
                >
                  Renovar 30 días
                </button>
              )}
              {renovado === aviso.id && (
                <span
                  role="status"
                  className="text-[13px] font-semibold text-primary-strong"
                >
                  Renovado ✓
                </span>
              )}
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
              {confirming === aviso.id && (
                <button
                  type="button"
                  onClick={cancelarConfirmacion}
                  className="rounded-xl bg-primary-faint px-4 py-2.5 text-[13px] font-semibold text-text-main transition-colors hover:bg-primary-soft"
                >
                  Cancelar
                </button>
              )}
            </div>

            {errorDe?.id === aviso.id && (
              <p role="alert" className="w-full text-[13px] text-error">
                {errorDe.mensaje}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
