import { useState } from "react";
import { supabaseBrowser } from "../../lib/supabase/browser";
import type { BusinessHour } from "../../lib/hours";

type DayState = {
  mode: "closed" | "open" | "open_24";
  open: string; // "09:00"
  close: string; // "18:00"
};

type Props = {
  businessId: string;
  initialHours: BusinessHour[];
  /** El negocio atiende con turno: sin horarios fijos. */
  initialByAppointment?: boolean;
};

const DAYS = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
];

function buildInitialState(hours: BusinessHour[]): DayState[] {
  return DAYS.map((_, day) => {
    const h = hours.find((x) => x.day_of_week === day);
    if (!h || h.is_closed) {
      return { mode: "closed" as const, open: "09:00", close: "18:00" };
    }
    if (h.is_open_24) {
      return { mode: "open_24" as const, open: "09:00", close: "18:00" };
    }
    return {
      mode: "open" as const,
      open: h.open_time?.slice(0, 5) ?? "09:00",
      close: h.close_time?.slice(0, 5) ?? "18:00",
    };
  });
}

export default function HoursEditor({
  businessId,
  initialHours,
  initialByAppointment = false,
}: Props) {
  const [days, setDays] = useState<DayState[]>(() =>
    buildInitialState(initialHours),
  );
  const [byAppointment, setByAppointment] = useState(initialByAppointment);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (index: number, patch: Partial<DayState>) => {
    setDays((prev) =>
      prev.map((d, i) => (i === index ? { ...d, ...patch } : d)),
    );
    setSaved(false);
  };

  const save = async () => {
    setSaving(true);
    setError(null);

    try {
      // El flag "con turno" vive en el negocio; la ficha pública lo muestra
      // en lugar del estado abierto/cerrado
      const { error: flagError } = await supabaseBrowser
        .from("businesses")
        .update({ by_appointment: byAppointment })
        .eq("id", businessId);
      if (flagError) throw flagError;

      // Con turno no hay horarios fijos que sincronizar
      if (!byAppointment) {
        // Sync simple: borrar y volver a insertar los 7 días
        const { error: delError } = await supabaseBrowser
          .from("business_hours")
          .delete()
          .eq("business_id", businessId);
        if (delError) throw delError;

        const rows = days.map((d, day_of_week) => ({
          business_id: businessId,
          day_of_week,
          is_closed: d.mode === "closed",
          is_open_24: d.mode === "open_24",
          open_time: d.mode === "open" ? d.open : null,
          close_time: d.mode === "open" ? d.close : null,
        }));

        const { error: insError } = await supabaseBrowser
          .from("business_hours")
          .insert(rows);
        if (insError) throw insError;
      }

      setSaved(true);
    } catch (err: any) {
      console.error(err);
      setError("No pudimos guardar los horarios. Probá de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Trabaja con turno: no carga horarios y la ficha lo dice */}
      <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3">
        <input
          type="checkbox"
          checked={byAppointment}
          onChange={(e) => {
            setByAppointment(e.target.checked);
            setSaved(false);
          }}
          className="h-4 w-4 accent-green-600"
        />
        <span className="text-sm">
          <span className="font-semibold">Atiendo con turno</span>
          <span className="block text-xs text-gray-500">
            No cargás horarios fijos: tu ficha va a decir "Atiende con turno"
            para que te contacten y coordinen.
          </span>
        </span>
      </label>

      {byAppointment ? (
        <p className="rounded-xl bg-blue-50 p-3 text-sm text-blue-700">
          Tu negocio se muestra como <b>"Atiende con turno"</b> en vez del
          horario de apertura. Guardá para aplicar el cambio.
        </p>
      ) : (
      <div className="space-y-2">
        {DAYS.map((label, i) => {
          const d = days[i];
          return (
            <div
              key={label}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 px-4 py-2"
            >
              <span className="w-24 text-sm font-semibold">{label}</span>

              <select
                value={d.mode}
                onChange={(e) => update(i, { mode: e.target.value as any })}
                className="field select-field w-auto py-1.5"
              >
                <option value="closed">Cerrado</option>
                <option value="open">Abierto</option>
                <option value="open_24">Abierto 24hs</option>
              </select>

              {d.mode === "open" && (
                <span className="flex items-center gap-2 text-sm">
                  <input
                    type="time"
                    value={d.open}
                    onChange={(e) => update(i, { open: e.target.value })}
                    className="field w-auto px-2 py-1.5"
                  />
                  a
                  <input
                    type="time"
                    value={d.close}
                    onChange={(e) => update(i, { close: e.target.value })}
                    className="field w-auto px-2 py-1.5"
                  />
                </span>
              )}
            </div>
          );
        })}
      </div>
      )}

      {error && (
        <p className="rounded-xl bg-red-50 p-3 text-sm text-red-600">{error}</p>
      )}
      {saved && (
        <p className="rounded-xl bg-green-50 p-3 text-sm text-green-700">
          ✓ Horarios guardados
        </p>
      )}

      <button
        onClick={save}
        disabled={saving}
        className="rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-green-700 disabled:opacity-60"
      >
        {saving
          ? "Guardando…"
          : byAppointment
            ? "Guardar"
            : "Guardar horarios"}
      </button>
    </div>
  );
}
