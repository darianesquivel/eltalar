import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import {
  classifiedCategory,
  formatPriceText,
} from "../../lib/repositories/classified.repository";

type Aviso = {
  category: string;
  title: string;
  description: string | null;
  price_text: string | null;
  whatsapp: string | null;
  author_name: string;
  photo_url: string | null;
  published_at: string | null;
};

type Props = {
  barrioName: string;
};

const whatsappLogo = "/images/whatsapp-icon.svg";

const sinceLabel = (iso: string | null) => {
  if (!iso) return "";
  const hours = Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000);
  if (hours < 1) return "recién";
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "ayer" : `hace ${days} días`;
};

/**
 * Detalle de un aviso en ventana emergente.
 *
 * Las cards las sigue renderizando el servidor (importa para el SEO y para
 * el primer paint); esta isla solo escucha los clicks sobre ellas y abre el
 * detalle, con flechas para recorrer los avisos sin cerrar y volver a abrir.
 */
export default function ClassifiedModal({ barrioName }: Props) {
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [indice, setIndice] = useState<number | null>(null);
  const cerrarRef = useRef<HTMLButtonElement>(null);
  const tocoEn = useRef<number | null>(null);

  // Los datos viajan en un <script type="application/json"> que imprime la
  // página: así no se duplica el listado en el HTML.
  useEffect(() => {
    const nodo = document.getElementById("avisos-data");
    if (nodo?.textContent) {
      try {
        setAvisos(JSON.parse(nodo.textContent));
      } catch {
        setAvisos([]);
      }
    }
  }, []);

  // Click en cualquier card de la grilla (delegación: sirve igual si la
  // grilla cambia). Los links internos siguen su camino.
  useEffect(() => {
    const alClickear = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("a") || target.closest("button")) return;

      const card = target.closest<HTMLElement>("[data-aviso]");
      if (!card) return;

      const i = Number(card.dataset.aviso);
      if (Number.isInteger(i)) setIndice(i);
    };

    // La card se puede enfocar con el teclado: Enter y espacio la abren
    const alTeclearCard = (e: KeyboardEvent) => {
      if (e.key !== "Enter" && e.key !== " ") return;

      const card = (e.target as HTMLElement).closest<HTMLElement>(
        "[data-aviso]",
      );
      if (!card) return;

      e.preventDefault();
      const i = Number(card.dataset.aviso);
      if (Number.isInteger(i)) setIndice(i);
    };

    document.addEventListener("click", alClickear);
    document.addEventListener("keydown", alTeclearCard);
    return () => {
      document.removeEventListener("click", alClickear);
      document.removeEventListener("keydown", alTeclearCard);
    };
  }, []);

  const cerrar = useCallback(() => setIndice(null), []);

  const mover = useCallback(
    (paso: number) => {
      setIndice((actual) => {
        if (actual === null || avisos.length === 0) return actual;
        return (actual + paso + avisos.length) % avisos.length;
      });
    },
    [avisos.length],
  );

  // Teclado y bloqueo del scroll de fondo
  useEffect(() => {
    if (indice === null) return;

    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape") cerrar();
      if (e.key === "ArrowRight") mover(1);
      if (e.key === "ArrowLeft") mover(-1);
    };

    document.addEventListener("keydown", alTeclear);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    cerrarRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", alTeclear);
      document.body.style.overflow = overflow;
    };
  }, [indice, cerrar, mover]);

  if (indice === null || !avisos[indice]) return null;

  const aviso = avisos[indice];
  const categoria = classifiedCategory(aviso.category);
  const hayVarios = avisos.length > 1;

  const whatsappUrl = aviso.whatsapp
    ? `https://wa.me/${aviso.whatsapp}?text=${encodeURIComponent(
        `¡Hola! Vi tu aviso "${aviso.title}" en ${barrioName}.`,
      )}`
    : null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={aviso.title}
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) cerrar();
      }}
      // En el celular se pasa de aviso arrastrando
      onTouchStart={(e) => (tocoEn.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (tocoEn.current === null) return;
        const dif = e.changedTouches[0].clientX - tocoEn.current;
        if (Math.abs(dif) > 60) mover(dif < 0 ? 1 : -1);
        tocoEn.current = null;
      }}
    >
      <div className="relative max-h-[92vh] w-full max-w-[560px] overflow-y-auto rounded-t-3xl bg-bg-card sm:rounded-3xl">
        <button
          ref={cerrarRef}
          type="button"
          onClick={cerrar}
          aria-label="Cerrar"
          className="absolute right-3 top-3 z-10 flex size-9 items-center justify-center rounded-full bg-white/90 text-text-main shadow-soft"
        >
          <X size={18} />
        </button>

        <div className="relative h-[220px] sm:h-[280px]">
          {aviso.photo_url ? (
            <img
              src={aviso.photo_url}
              alt={aviso.title}
              className="size-full object-cover"
            />
          ) : (
            <div className="img-placeholder size-full" />
          )}

          <span
            className="absolute left-4 top-4 rounded-full px-2.5 py-1.5 text-[11.5px] font-bold"
            style={{ background: categoria.bg, color: categoria.fg }}
          >
            {categoria.label}
          </span>

          {hayVarios && (
            <>
              <button
                type="button"
                onClick={() => mover(-1)}
                aria-label="Aviso anterior"
                className="absolute left-3 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-text-main shadow-soft"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                type="button"
                onClick={() => mover(1)}
                aria-label="Aviso siguiente"
                className="absolute right-3 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-text-main shadow-soft"
              >
                <ChevronRight size={20} />
              </button>
            </>
          )}
        </div>

        <div className="flex flex-col gap-3 p-5 sm:p-6">
          <div>
            <h2 className="text-[20px] font-extrabold leading-tight text-text-main sm:text-[24px]">
              {aviso.title}
            </h2>
            {aviso.price_text && (
              <div className="mt-1.5 text-[20px] font-extrabold text-primary-strong sm:text-[22px]">
                {formatPriceText(aviso.price_text)}
              </div>
            )}
          </div>

          {aviso.description && (
            <p className="whitespace-pre-line text-[14.5px] leading-relaxed text-text-body">
              {aviso.description}
            </p>
          )}

          <div className="text-[13px] text-text-muted">
            Publicado por {aviso.author_name} · {sinceLabel(aviso.published_at)}
          </div>

          {whatsappUrl && (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 rounded-[14px] bg-primary p-3.5 text-[15px] font-semibold text-white transition-colors hover:bg-primary-hover"
            >
              <img
                src={whatsappLogo}
                width="16"
                height="16"
                alt=""
                className="brightness-0 invert"
              />
              Contactar por WhatsApp
            </a>
          )}

          {hayVarios && (
            <div className="text-center text-[12.5px] text-text-muted">
              Aviso {indice + 1} de {avisos.length}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
