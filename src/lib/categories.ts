/**
 * Color e ícono de cada rubro, para los cuadraditos de la grilla de rubros
 * y los chips. Los valores salen del mapa STYLES de CategoryPlaceholder.tsx
 * (que sigue existiendo como fallback de las fichas sin foto): acá viven
 * como datos planos para poder usarlos también desde componentes .astro.
 */

export type CategoryStyle = {
  /** Nombre del ícono de Lucide (mismo nombre en @lucide/astro y lucide-react). */
  icon: string;
  /** Fondo suave del cuadradito. */
  soft: string;
  /** Color del ícono. */
  fg: string;
};

export const CATEGORY_STYLES: Record<string, CategoryStyle> = {
  gastronomia: { icon: "UtensilsCrossed", soft: "#FFF3E4", fg: "#B05F22" },
  cafeteria: { icon: "Coffee", soft: "#F5EDE4", fg: "#83552F" },
  farmacia: { icon: "Pill", soft: "#E4F5EC", fg: "#1F8A5D" },
  salud: { icon: "HeartPulse", soft: "#E0F2F4", fg: "#16768A" },
  gimnasio: { icon: "Dumbbell", soft: "#FDEAEA", fg: "#AE3E3A" },
  peluqueria: { icon: "Scissors", soft: "#FBE9F2", fg: "#AB4279" },
  ferreteria: { icon: "Hammer", soft: "#ECEFF3", fg: "#49596D" },
  carniceria: { icon: "Beef", soft: "#FBE9E7", fg: "#A34232" },
  libreria: { icon: "BookOpen", soft: "#EBEDFB", fg: "#49539E" },
  almacen: { icon: "ShoppingBasket", soft: "#FCF3DF", fg: "#9E7522" },
  fruteria: { icon: "Apple", soft: "#EFF8E3", fg: "#588726" },
  verduleria: { icon: "Carrot", soft: "#E9F6E4", fg: "#3E8732" },
  mascotas: { icon: "PawPrint", soft: "#F1ECFA", fg: "#67489E" },
  automotor: { icon: "Car", soft: "#E8EFF7", fg: "#32608C" },
  construccion: { icon: "HardHat", soft: "#FBF2DE", fg: "#93761D" },
  servicios: { icon: "Wrench", soft: "#E7F0F8", fg: "#2E6595" },
  "desarrollo-web": { icon: "Code", soft: "#E4F5F6", fg: "#20757C" },
  indumentaria: { icon: "Shirt", soft: "#F9EBF7", fg: "#953C86" },
  "hogar-y-muebles": { icon: "Armchair", soft: "#F0F1EA", fg: "#666C3E" },
  "educacion-y-deporte": {
    icon: "GraduationCap",
    soft: "#E8F0FB",
    fg: "#325796",
  },
  "alojamiento-y-eventos": { icon: "BedDouble", soft: "#F0EBFA", fg: "#5C439C" },
  "industria-y-mayoristas": { icon: "Factory", soft: "#EDEEF0", fg: "#535E69" },
};

export const DEFAULT_CATEGORY_STYLE: CategoryStyle = {
  icon: "Store",
  soft: "#EEF2EC",
  fg: "#4B795B",
};

export function categoryStyle(slug?: string | null): CategoryStyle {
  return (slug && CATEGORY_STYLES[slug]) || DEFAULT_CATEGORY_STYLE;
}
