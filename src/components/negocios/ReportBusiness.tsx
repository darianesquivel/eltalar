import { useState } from "react";
import { Flag } from "lucide-react";

type Props = {
  slug: string;
  businessName: string;
};

const MOTIVOS = [
  "Cerró definitivamente",
  "No existe o nunca existió",
  "Datos incorrectos (teléfono, horarios, dirección)",
  "Está repetido",
  "Otro",
];

/**
 * "Reportar un error" en la ficha pública: los vecinos avisan si un negocio
 * cerró o tiene datos mal. Clave para curar la carga masiva de Google Maps.
 */
export default function ReportBusiness({ slug, businessName }: Props) {
  const [open, setOpen] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [detalle, setDetalle] = useState("");
  const [email, setEmail] = useState("");
  // Honeypot: la API descarta el reporte si viene con "company" cargado
  const [company, setCompany] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!motivo) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/reportar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          businessName,
          motivo,
          detalle,
          email,
          company,
        }),
      });
      if (!res.ok) {
        // El servidor suele explicar qué pasó: mejor mostrarlo que taparlo
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || body?.message || "");
      }
      setDone(true);
    } catch (err) {
      setError(
        (err as Error)?.message ||
          "No pudimos enviar el reporte, probá de nuevo.",
      );
    } finally {
      setSending(false);
    }
  };

  if (done) {
    return (
      <p className="rounded-xl bg-primary-faint px-5 py-3 text-center text-sm text-text-body">
        ¡Gracias por avisar! Vamos a revisar esta ficha.
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center gap-[7px] rounded-xl bg-primary-faint px-[18px] py-3 text-[13.5px] font-semibold text-text-main transition-colors hover:bg-primary-soft"
      >
        <Flag size={15} />
        Reportar un error en la ficha
      </button>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="w-full space-y-3 rounded-2xl border border-border bg-bg-main p-4"
    >
      <p className="text-sm font-semibold text-text-main">
        Reportar un error en esta ficha
      </p>

      <label htmlFor="reporte-motivo" className="sr-only">
        ¿Qué está mal?
      </label>
      <select
        id="reporte-motivo"
        required
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
        className="field select-field w-full text-sm"
      >
        <option value="">¿Qué está mal?</option>
        {MOTIVOS.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>

      <label htmlFor="reporte-detalle" className="sr-only">
        Contanos más (opcional)
      </label>
      <textarea
        id="reporte-detalle"
        value={detalle}
        onChange={(e) => setDetalle(e.target.value)}
        placeholder="Contanos más (opcional)"
        rows={2}
        maxLength={1000}
        className="field w-full text-sm"
      />

      <label htmlFor="reporte-email" className="sr-only">
        Tu email (opcional)
      </label>
      <input
        id="reporte-email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Tu email (opcional, por si necesitamos consultarte)"
        maxLength={200}
        className="field w-full text-sm"
      />

      {/* Honeypot: oculto para las personas, irresistible para los bots */}
      <input
        type="text"
        name="company"
        tabIndex={-1}
        autoComplete="off"
        value={company}
        onChange={(e) => setCompany(e.target.value)}
        className="hidden"
        aria-hidden="true"
      />

      {error && (
        <p role="alert" className="text-[13px] text-error">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={sending || !motivo}
          className="flex-1 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
        >
          {sending ? "Enviando…" : "Enviar reporte"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-full border border-border px-4 py-3 text-sm text-text-body transition-colors hover:bg-bg-muted"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
