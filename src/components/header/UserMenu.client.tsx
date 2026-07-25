import { useEffect, useRef, useState } from "react";
import { ChevronDown, LogOut, Megaphone, Store } from "lucide-react";
import { leerSesionLocal, type SesionLocal } from "../../lib/session";

const ITEMS = [
  { href: "/app", label: "Mis negocios", icon: Store },
  { href: "/avisos/mios", label: "Mis avisos", icon: Megaphone },
];

/**
 * Avatar con menú del usuario, solo visible con sesión iniciada.
 *
 * Las páginas públicas las cachea el CDN (mismo HTML para todos), así que
 * lo personalizado se resuelve acá, en el navegador. Los datos salen de la
 * cookie: getSession() de Supabase puede colgarse intentando refrescar el
 * token, y el header no puede quedar esperando a la red para dibujarse.
 */
export default function UserMenu() {
  const [perfil, setPerfil] = useState<SesionLocal | null>(null);
  const [abierto, setAbierto] = useState(false);
  const caja = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const refrescar = () => setPerfil(leerSesionLocal());

    refrescar();

    // Al volver a la pestaña, por si inició o cerró sesión en otra
    document.addEventListener("visibilitychange", refrescar);
    return () => document.removeEventListener("visibilitychange", refrescar);
  }, []);

  // Cerrar al hacer click afuera o con Escape
  useEffect(() => {
    if (!abierto) return;

    const alClickear = (e: MouseEvent) => {
      if (!caja.current?.contains(e.target as Node)) setAbierto(false);
    };
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAbierto(false);
    };

    document.addEventListener("mousedown", alClickear);
    document.addEventListener("keydown", alTeclear);
    return () => {
      document.removeEventListener("mousedown", alClickear);
      document.removeEventListener("keydown", alTeclear);
    };
  }, [abierto]);

  if (!perfil) return null;

  const inicial = perfil.nombre.charAt(0).toUpperCase();

  return (
    <div ref={caja} className="relative">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={abierto}
        aria-label="Mi cuenta"
        className="flex items-center gap-1.5 rounded-full p-0.5 pr-1.5 transition-colors hover:bg-primary-faint"
      >
        {perfil.avatar ? (
          <img
            src={perfil.avatar}
            alt=""
            width={32}
            height={32}
            referrerPolicy="no-referrer"
            className="size-8 rounded-full object-cover"
          />
        ) : (
          <span className="flex size-8 items-center justify-center rounded-full bg-primary-soft text-[14px] font-extrabold text-primary-strong">
            {inicial}
          </span>
        )}
        <ChevronDown size={15} className="text-text-muted" />
      </button>

      {abierto && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+8px)] z-50 w-[240px] overflow-hidden rounded-2xl border border-border bg-bg-card shadow-card"
        >
          <div className="border-b border-border px-4 py-3">
            <div className="truncate text-[14px] font-bold text-text-main">
              {perfil.nombre}
            </div>
            {perfil.email && (
              <div className="truncate text-[12.5px] text-text-muted">
                {perfil.email}
              </div>
            )}
          </div>

          <div className="p-1.5">
            {ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <a
                  key={item.href}
                  href={item.href}
                  role="menuitem"
                  className="flex items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-[14px] font-medium text-text-body transition-colors hover:bg-primary-faint hover:text-text-main"
                >
                  <Icon size={17} className="text-primary" />
                  {item.label}
                </a>
              );
            })}
          </div>

          <form
            method="POST"
            action="/api/auth/signout"
            className="border-t border-border p-1.5"
          >
            {/* Cerrar sesión desde el sitio público deja al vecino en la
                home, no en la página de ingreso del panel. */}
            <input type="hidden" name="next" value="/" />
            <button
              type="submit"
              role="menuitem"
              className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-left text-[14px] font-medium text-text-body transition-colors hover:bg-bg-muted"
            >
              <LogOut size={17} className="text-text-muted" />
              Cerrar sesión
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
