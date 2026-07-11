import type { ReactNode } from "react";

type Variant = "default" | "success" | "danger" | "warning";

type IconButtonProps = {
  label: string; // tooltip + aria-label
  onClick?: () => void;
  href?: string; // si viene, renderiza un <a>
  disabled?: boolean;
  variant?: Variant;
  active?: boolean; // estado "encendido" (ej: destacado)
  children: ReactNode; // el ícono
};

const VARIANTS: Record<Variant, string> = {
  default: "text-gray-500 hover:bg-gray-100 hover:text-gray-700",
  success: "text-green-600 hover:bg-green-50",
  danger: "text-red-500 hover:bg-red-50",
  warning: "text-amber-500 hover:bg-amber-50",
};

/** Botón de solo ícono con tooltip (aparece arriba al hacer hover). */
export default function IconButton({
  label,
  onClick,
  href,
  disabled,
  variant = "default",
  active = false,
  children,
}: IconButtonProps) {
  const className = `inline-flex h-8 w-8 items-center justify-center rounded-lg border transition disabled:opacity-40 ${
    active
      ? "border-amber-300 bg-amber-100 text-amber-600"
      : `border-gray-200 bg-white ${VARIANTS[variant]}`
  }`;

  // Debajo del botón: arriba lo recortan los contenedores con scroll
  // (las primeras filas de las listas del admin quedaban con tooltip cortado).
  const tooltip = (
    <span
      role="tooltip"
      className="pointer-events-none absolute right-0 top-full z-20 mt-1.5 whitespace-nowrap rounded-md bg-gray-900 px-2 py-1 text-[11px] font-medium text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100"
    >
      {label}
    </span>
  );

  if (href) {
    return (
      <span className="group relative inline-flex">
        {tooltip}
        <a href={href} aria-label={label} className={className}>
          {children}
        </a>
      </span>
    );
  }

  return (
    <span className="group relative inline-flex">
      {tooltip}
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        className={className}
      >
        {children}
      </button>
    </span>
  );
}
