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
        body: JSON.stringify({ slug, businessName, motivo, detalle, email }),
      });
      if (!res.ok) throw new Error();
      setDone(true);
    } catch {
      setError("No pudimos enviar el reporte, probá de nuevo.");
    } finally {
      setSending(false);
    }
  };

  if (done) {
    return (
      <p className="rounded-2xl bg-gray-50 px-5 py-3 text-center text-sm text-gray-600">
        ¡Gracias por avisar! Vamos a revisar esta ficha.
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mx-auto flex items-center gap-1.5 text-xs text-gray-400 transition hover:text-gray-600"
      >
        <Flag size={13} />
        ¿Algo está mal en esta ficha? Reportar un error
      </button>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="space-y-3 rounded-2xl border border-gray-200 bg-gray-50 p-4"
    >
      <p className="text-sm font-semibold text-gray-700">
        Reportar un error en esta ficha
      </p>

      <select
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

      <textarea
        value={detalle}
        onChange={(e) => setDetalle(e.target.value)}
        placeholder="Contanos más (opcional)"
        rows={2}
        maxLength={1000}
        className="field w-full text-sm"
      />

      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Tu email (opcional, por si necesitamos consultarte)"
        maxLength={200}
        className="field w-full text-sm"
      />

      {error && <p className="text-xs text-red-500">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={sending || !motivo}
          className="flex-1 rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-green-700 disabled:opacity-50"
        >
          {sending ? "Enviando…" : "Enviar reporte"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-full border border-gray-300 px-4 py-1.5 text-sm text-gray-500 transition hover:bg-gray-100"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
