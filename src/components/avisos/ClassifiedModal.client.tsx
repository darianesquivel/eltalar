import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import {
  classifiedCategory,
  formatPriceText,
} from "../../lib/repositories/classified.repository";
import { cdnImage } from "../../lib/images";

type Aviso = {
  category: string;
  title: string;
  description: string | null;
  price_text: string | null;
  whatsapp: string | null;
  author_name: string;
  photo_url: string | null;
  /** "hace 3 días", ya renderizado por el servidor en la card. */
  since: string;
};

type Props = {
  barrioName: string;
};

const whatsappLogo = "/images/whatsapp-icon.svg";

/**
 * La card muestra la foto achicada por /_vercel/image; el modal la quiere
 * más grande, así que recupera la URL original del parámetro `url` del
 * proxy (en dev la src ya es la original).
 */
const originalPhoto = (src: string | null): string | null => {
  if (!src) return null;
  if (src.includes("/_vercel/image")) {
    try {
      return new URL(src, window.location.origin).searchParams.get("url");
    } catch {
      return src;
    }
  }
  return src;
};

/** Arma un Aviso desde los marcadores data-* de la card servida. */
const leerCard = (card: HTMLElement): Aviso => {
  const foto = card.querySelector<HTMLImageElement>("img[data-f]");
  const link = card.querySelector<HTMLAnchorElement>('a[href^="https://wa.me/"]');
  let whatsapp: string | null = null;
  if (link) {
    const num = new URL(link.href).pathname.slice(1);
    if (/^\d+$/.test(num)) whatsapp = num;
  }

  return {
    category: card.dataset.cat ?? "",
    title: card.querySelector("[data-t]")?.textContent?.trim() ?? "",
    description: card.querySelector("[data-d]")?.textContent?.trim() || null,
    price_text: card.querySelector("[data-p]")?.textContent?.trim() || null,
    whatsapp,
    author_name: card.querySelector("[data-a]")?.textContent?.trim() ?? "",
    photo_url: originalPhoto(foto?.getAttribute("src") ?? null),
    since: card.querySelector("[data-s]")?.textContent?.trim() ?? "",
  };
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
  const [fotoAmpliada, setFotoAmpliada] = useState(false);
  const cerrarRef = useRef<HTMLButtonElement>(null);
  const dialogoRef = useRef<HTMLDivElement>(null);
  const tocoEn = useRef<{ x: number; y: number } | null>(null);

  // Los datos se leen de las MISMAS cards que sirvió el servidor (marcadores
  // data-*): antes viajaba además una copia JSON del listado completo y el
  // HTML pesaba el doble.
  useEffect(() => {
    try {
      const cards = [
        ...document.querySelectorAll<HTMLElement>("[data-aviso]"),
      ].sort((a, b) => Number(a.dataset.aviso) - Number(b.dataset.aviso));
      setAvisos(cards.map(leerCard));
    } catch (err) {
      // Sin datos el modal nunca abre: que al menos quede rastro en consola
      console.error("No se pudieron leer las cards de avisos", err);
      setAvisos([]);
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
      setFotoAmpliada(false);
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
      if (e.key === "Escape") {
        if (fotoAmpliada) setFotoAmpliada(false);
        else cerrar();
      }
      if (e.key === "ArrowRight") mover(1);
      if (e.key === "ArrowLeft") mover(-1);
    };

    document.addEventListener("keydown", alTeclear);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", alTeclear);
      document.body.style.overflow = overflow;
    };
  }, [indice, fotoAmpliada, cerrar, mover]);

  // El foco va al botón de cerrar solo al abrir el detalle. Si dependiera de
  // fotoAmpliada, ampliar la foto devolvería el foco detrás del lightbox.
  const abierto = indice !== null;
  useEffect(() => {
    if (abierto) cerrarRef.current?.focus();
  }, [abierto]);

  // Trampa de foco mínima: Tab no se escapa del diálogo hacia la página
  const atraparFoco = (e: React.KeyboardEvent) => {
    if (e.key !== "Tab" || !dialogoRef.current) return;
    const focusables = dialogoRef.current.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    if (focusables.length === 0) return;
    const primero = focusables[0];
    const ultimo = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === primero) {
      e.preventDefault();
      ultimo.focus();
    } else if (!e.shiftKey && document.activeElement === ultimo) {
      e.preventDefault();
      primero.focus();
    }
  };

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
      ref={dialogoRef}
      role="dialog"
      aria-modal="true"
      aria-label={aviso.title}
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) cerrar();
      }}
      onKeyDown={atraparFoco}
      // En el celular se pasa de aviso arrastrando
      onTouchStart={(e) =>
        (tocoEn.current = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
        })
      }
      onTouchEnd={(e) => {
        if (tocoEn.current === null) return;
        const dx = e.changedTouches[0].clientX - tocoEn.current.x;
        const dy = e.changedTouches[0].clientY - tocoEn.current.y;
        // Solo cuenta el gesto horizontal: el scroll vertical no cambia de aviso
        if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) {
          mover(dx < 0 ? 1 : -1);
        }
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

        <div className="relative h-[220px] bg-secondary sm:h-[280px]">
          {aviso.photo_url ? (
            // Entra completa, sin recortar: en la card se recorta para que
            // la grilla quede pareja, pero acá el vecino quiere ver la cosa.
            <button
              type="button"
              onClick={() => setFotoAmpliada(true)}
              aria-label="Ver la foto en grande"
              className="size-full cursor-zoom-in"
            >
              <img
                src={cdnImage(aviso.photo_url, 640) ?? undefined}
                alt={aviso.title}
                className="size-full object-contain"
              />
            </button>
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
            Publicado por {aviso.author_name} · {aviso.since}
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

      {fotoAmpliada && aviso.photo_url && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/95 p-4"
          onClick={(e) => {
            e.stopPropagation();
            setFotoAmpliada(false);
          }}
        >
          <img
            src={cdnImage(aviso.photo_url, 1280) ?? undefined}
            alt={aviso.title}
            className="max-h-full max-w-full object-contain"
          />
          <button
            type="button"
            onClick={() => setFotoAmpliada(false)}
            aria-label="Cerrar la foto"
            className="absolute right-4 top-4 flex size-10 items-center justify-center rounded-full bg-white/90 text-text-main"
          >
            <X size={18} />
          </button>
        </div>
      )}
    </div>
  );
}
