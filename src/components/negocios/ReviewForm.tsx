import { useEffect, useState } from "react";
import { Star } from "lucide-react";

type Props = {
  businessId: string;
  businessName: string;
};

/**
 * "Escribir una reseña" de la ficha pública. Hace falta estar logueado:
 * si el endpoint responde 401, se ofrece el login con Google que ya existe.
 * La reseña queda pendiente hasta que un admin la aprueba.
 */
export default function ReviewForm({ businessId, businessName }: Props) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsLogin, setNeedsLogin] = useState(false);

  // Si el vecino se fue a loguear, la reseña a medio escribir lo espera acá
  const storageKey = `resena-borrador-${businessId}`;

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (!raw) return;
      const borrador = JSON.parse(raw) as { rating?: number; comment?: string };
      if (borrador.rating) setRating(borrador.rating);
      if (borrador.comment) setComment(borrador.comment);
      setOpen(true);
    } catch {
      // Sin borrador (o ilegible): se arranca de cero
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rating) return;

    setSending(true);
    setError(null);
    setNeedsLogin(false);

    try {
      const res = await fetch("/api/resenas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, rating, comment }),
      });

      if (res.status === 401) {
        // Se guarda lo escrito antes de mandar al login, para no perderlo
        try {
          sessionStorage.setItem(storageKey, JSON.stringify({ rating, comment }));
        } catch {
          // Sin sessionStorage el login sigue andando, solo se pierde el texto
        }
        setNeedsLogin(true);
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(
          body?.message ||
            (res.status >= 500
              ? "Tuvimos un problema nuestro, probá más tarde."
              : "No pudimos guardar tu reseña, revisá los datos."),
        );
      }
      try {
        sessionStorage.removeItem(storageKey);
      } catch {
        // Nada para limpiar
      }
      setDone(true);
    } catch (err) {
      setError(
        (err as Error)?.message || "No pudimos guardar tu reseña, probá de nuevo.",
      );
    } finally {
      setSending(false);
    }
  };

  if (done) {
    return (
      <p className="rounded-xl bg-primary-soft px-5 py-3 text-center text-sm text-primary-strong">
        ¡Gracias! Tu reseña queda visible apenas la revisemos.
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-xl bg-primary-faint px-[18px] py-[11px] text-[13.5px] font-semibold text-text-main transition-colors hover:bg-primary-soft"
      >
        Escribir una reseña
      </button>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="w-full space-y-3 rounded-2xl border border-border bg-bg-main p-4"
    >
      <p className="text-sm font-semibold text-text-main">
        ¿Cómo te fue en {businessName}?
      </p>

      <div
        role="radiogroup"
        aria-label="Puntaje, de 1 a 5 estrellas"
        className="flex items-center gap-1"
      >
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={rating === value}
            aria-label={`${value} ${value === 1 ? "estrella" : "estrellas"}`}
            onClick={() => setRating(value)}
            onMouseEnter={() => setHover(value)}
            onMouseLeave={() => setHover(0)}
            onFocus={() => setHover(value)}
            onBlur={() => setHover(0)}
            className="p-0.5"
          >
            <Star
              size={26}
              className={
                value <= (hover || rating)
                  ? "fill-rating text-rating"
                  : "text-text-faint"
              }
            />
          </button>
        ))}
      </div>

      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Contales a tus vecinos cómo te atendieron (opcional)"
        rows={3}
        maxLength={1000}
        className="field w-full text-sm"
      />

      {needsLogin && (
        <p className="text-[13px] text-text-body">
          Para dejar una reseña hace falta una cuenta.{" "}
          <a
            href={`/app/login?next=${encodeURIComponent(window.location.pathname)}`}
            className="font-semibold text-primary-strong"
          >
            Entrar con Google
          </a>
        </p>
      )}

      {error && <p className="text-[13px] text-error">{error}</p>}

      <p className="text-[12.5px] text-text-muted">
        Se publica después de una revisión rápida, para evitar reseñas falsas.
      </p>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={sending || !rating}
          className="flex-1 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
        >
          {sending ? "Enviando…" : "Enviar reseña"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-xl border border-border px-4 py-2.5 text-sm text-text-body transition-colors hover:bg-bg-muted"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
