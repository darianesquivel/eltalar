import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";

type Props = {
  value: string;
  /** Cambió el texto (tipeo manual: las coordenadas dejan de valer). */
  onChange: (address: string) => void;
  /** Eligió una sugerencia: dirección normalizada + coordenadas. */
  onSelect: (address: string, lat: number | null, lng: number | null) => void;
  placeholder?: string;
};

type Suggestion = { placeId: string; texto: string };

/**
 * Input de dirección con autocompletado (estilo apps de viajes): sugiere
 * mientras se tipea y al elegir guarda también las coordenadas, así el
 * negocio aparece en el mapa sin geocoding posterior.
 */
export default function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = "Calle y altura (ej: Perú 749)",
}: Props) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const [resolving, setResolving] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const seqRef = useRef(0);
  const boxRef = useRef<HTMLDivElement>(null);

  // Cerrar al clickear afuera
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const fetchSuggestions = (q: string) => {
    clearTimeout(debounceRef.current);
    if (q.trim().length < 4) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      const seq = ++seqRef.current;
      try {
        const res = await fetch(`/api/direcciones?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        if (seq !== seqRef.current) return; // llegó tarde
        setSuggestions(data.suggestions ?? []);
        setOpen((data.suggestions ?? []).length > 0);
        setHighlighted(-1);
      } catch {
        /* sin sugerencias no se rompe nada: sigue siendo un input normal */
      }
    }, 350);
  };

  const pick = async (s: Suggestion) => {
    setOpen(false);
    setSuggestions([]);
    setResolving(true);
    try {
      const res = await fetch(`/api/direcciones?placeId=${encodeURIComponent(s.placeId)}`);
      const data = await res.json();
      const address = data.address ?? s.texto;
      onSelect(address, data.lat ?? null, data.lng ?? null);
    } catch {
      onSelect(s.texto, null, null);
    } finally {
      setResolving(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter" && highlighted >= 0) {
      e.preventDefault();
      pick(suggestions[highlighted]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={boxRef} className="relative">
      <input
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          fetchSuggestions(e.target.value);
        }}
        onKeyDown={onKeyDown}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        placeholder={placeholder}
        autoComplete="off"
        className="field"
        disabled={resolving}
      />

      {open && (
        <ul
          role="listbox"
          className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg"
        >
          {suggestions.map((s, i) => (
            <li key={s.placeId}>
              <button
                type="button"
                role="option"
                aria-selected={i === highlighted}
                onMouseEnter={() => setHighlighted(i)}
                onClick={() => pick(s)}
                className={`flex w-full items-start gap-2 px-3 py-2 text-left text-sm ${
                  i === highlighted ? "bg-primary-soft/40" : "bg-white"
                }`}
              >
                <MapPin size={15} className="mt-0.5 shrink-0 text-primary" />
                <span className="text-gray-700">{s.texto}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
