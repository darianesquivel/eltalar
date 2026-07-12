import {
  Apple,
  Armchair,
  BedDouble,
  Beef,
  BookOpen,
  Car,
  Carrot,
  Code,
  Coffee,
  Dumbbell,
  Factory,
  GraduationCap,
  Hammer,
  HardHat,
  HeartPulse,
  PawPrint,
  Pill,
  Scissors,
  Shirt,
  ShoppingBasket,
  Store,
  UtensilsCrossed,
  Wrench,
} from "lucide-react";
import type { ComponentType } from "react";

type Style = {
  icon: ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  from: string;
  to: string;
  fg: string;
};

// Portada de reemplazo para negocios sin foto: un degradé suave y el ícono
// del rubro, para que la grilla no quede llena de "sin imagen" repetidos.
const STYLES: Record<string, Style> = {
  gastronomia: { icon: UtensilsCrossed, from: "#FFF3E4", to: "#FFDFBC", fg: "#B05F22" },
  cafeteria: { icon: Coffee, from: "#F5EDE4", to: "#E7D4BF", fg: "#83552F" },
  farmacia: { icon: Pill, from: "#E4F5EC", to: "#C7E9D6", fg: "#1F8A5D" },
  salud: { icon: HeartPulse, from: "#E0F2F4", to: "#C2E5EA", fg: "#16768A" },
  gimnasio: { icon: Dumbbell, from: "#FDEAEA", to: "#F7D1D1", fg: "#AE3E3A" },
  peluqueria: { icon: Scissors, from: "#FBE9F2", to: "#F4CFE2", fg: "#AB4279" },
  ferreteria: { icon: Hammer, from: "#ECEFF3", to: "#D7DDE6", fg: "#49596D" },
  carniceria: { icon: Beef, from: "#FBE9E7", to: "#F4CEC8", fg: "#A34232" },
  libreria: { icon: BookOpen, from: "#EBEDFB", to: "#D4D8F3", fg: "#49539E" },
  almacen: { icon: ShoppingBasket, from: "#FCF3DF", to: "#F5E2B6", fg: "#9E7522" },
  fruteria: { icon: Apple, from: "#EFF8E3", to: "#DCEFC2", fg: "#588726" },
  verduleria: { icon: Carrot, from: "#E9F6E4", to: "#CFEBC4", fg: "#3E8732" },
  mascotas: { icon: PawPrint, from: "#F1ECFA", to: "#DFD4F2", fg: "#67489E" },
  automotor: { icon: Car, from: "#E8EFF7", to: "#CEDEED", fg: "#32608C" },
  construccion: { icon: HardHat, from: "#FBF2DE", to: "#F3E1B3", fg: "#93761D" },
  servicios: { icon: Wrench, from: "#E7F0F8", to: "#CEE1F0", fg: "#2E6595" },
  "desarrollo-web": { icon: Code, from: "#E4F5F6", to: "#C5E8EB", fg: "#20757C" },
  indumentaria: { icon: Shirt, from: "#F9EBF7", to: "#EFD2EA", fg: "#953C86" },
  "hogar-y-muebles": { icon: Armchair, from: "#F0F1EA", to: "#DEE1CF", fg: "#666C3E" },
  "educacion-y-deporte": { icon: GraduationCap, from: "#E8F0FB", to: "#CFDFF4", fg: "#325796" },
  "alojamiento-y-eventos": { icon: BedDouble, from: "#F0EBFA", to: "#DCD1F1", fg: "#5C439C" },
  "industria-y-mayoristas": { icon: Factory, from: "#EDEEF0", to: "#D8DBDF", fg: "#535E69" },
};

const DEFAULT_STYLE: Style = {
  icon: Store,
  from: "#EEF2EC",
  to: "#D8E1D5",
  fg: "#4B795B",
};

type Props = {
  /** Slug de la primera categoría del negocio (o undefined si no tiene). */
  categorySlug?: string | null;
  /** Nombre del negocio, para accesibilidad. */
  label: string;
  iconSize?: number;
  className?: string;
};

export default function CategoryPlaceholder({
  categorySlug,
  label,
  iconSize = 44,
  className = "",
}: Props) {
  const style = (categorySlug && STYLES[categorySlug]) || DEFAULT_STYLE;
  const Icon = style.icon;

  return (
    <div
      role="img"
      aria-label={label}
      className={`flex items-center justify-center ${className}`}
      style={{ background: `linear-gradient(135deg, ${style.from}, ${style.to})` }}
    >
      <div
        className="rounded-full bg-white/60 shadow-sm"
        style={{ padding: Math.max(10, Math.round(iconSize / 3)) }}
      >
        <Icon size={iconSize} color={style.fg} strokeWidth={1.5} />
      </div>
    </div>
  );
}
