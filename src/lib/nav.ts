/**
 * Navegación del sitio, en un solo lugar.
 *
 * En mobile la barra de abajo y el menú hamburguesa se reparten las
 * secciones: lo que está en la barra NO se repite en el menú. Con las
 * listas separadas en cada componente eso se desincronizaba al primer
 * cambio, así que viven acá.
 */

export type NavItem = {
  href: string;
  label: string;
  /** Nombre del ícono de Lucide (lo resuelve cada componente). */
  icon?: string;
};

/** Barra inferior fija de mobile: lo que más se usa desde el celular. */
export const TAB_ITEMS: Required<NavItem>[] = [
  { href: "/", label: "Inicio", icon: "House" },
  { href: "/negocios", label: "Buscar", icon: "Search" },
  { href: "/ofertas", label: "Ofertas", icon: "Flame" },
  { href: "/avisos", label: "Avisos", icon: "Megaphone" },
  { href: "/farmacias", label: "Farmacias", icon: "Pill" },
];

/** Nav de escritorio. */
export const NAV_ITEMS: NavItem[] = [
  { href: "/negocios", label: "Negocios" },
  { href: "/ofertas", label: "Ofertas" },
  { href: "/farmacias", label: "Farmacias" },
  { href: "/eventos", label: "Eventos" },
  { href: "/avisos", label: "Avisos" },
  { href: "/telefonos", label: "Teléfonos" },
  // El comerciante también necesita su puerta desde cualquier página: el
  // header ya no tiene botón de "Cargá tu negocio".
  { href: "/anunciate", label: "Anunciate" },
];

/** Secciones secundarias: nunca están en la barra inferior. */
export const MENU_EXTRA_ITEMS: NavItem[] = [
  { href: "/mapa", label: "Mapa" },
  { href: "/contacto", label: "Contacto" },
];

const enLaBarra = new Set(TAB_ITEMS.map((i) => i.href));

/**
 * Menú hamburguesa de mobile: solo lo que la barra de abajo no cubre.
 * Hoy queda Eventos, Teléfonos, Mapa, Anunciate y Contacto.
 */
export const MOBILE_MENU_ITEMS: NavItem[] = [
  ...NAV_ITEMS.filter((item) => !enLaBarra.has(item.href)),
  ...MENU_EXTRA_ITEMS,
];
