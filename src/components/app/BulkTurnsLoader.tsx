import { useState } from "react";
import { supabaseBrowser } from "../../lib/supabase/browser";

type Pharmacy = {
  id: string;
  name: string;
};

type Props = {
  pharmacies: Pharmacy[];
};

type ParsedLine = {
  raw: string;
  date: string | null; // "2026-08-15"
  pharmacy: Pharmacy | null;
  error: string | null;
};

/** Normaliza para comparar: minúsculas, sin tildes, sin "farmacia", solo alfanumérico */
const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/farmacia/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

function matchPharmacy(text: string, pharmacies: Pharmacy[]): Pharmacy | null {
  const target = norm(text);
  if (!target) return null;

  // 1. igualdad exacta
  let hit = pharmacies.find((p) => norm(p.name) === target);
  if (hit) return hit;

  // 2. una contiene a la otra (elige el match más específico)
  const candidates = pharmacies.filter((p) => {
    const n = norm(p.name);
    return n.includes(target) || target.includes(n);
  });
  if (candidates.length === 1) return candidates[0];
  if (candidates.length > 1) {
    candidates.sort((a, b) => norm(a.name).length - norm(b.name).length);
    return candidates[0];
  }

  // 3. todas las palabras de la línea aparecen en el nombre
  const words = target.split(" ").filter((w) => w.length > 2);
  if (words.length > 0) {
    hit = pharmacies.find((p) => {
      const n = norm(p.name);
      return words.every((w) => n.includes(w));
    });
    if (hit) return hit;
  }

  return null;
}

function parseLines(
  text: string,
  pharmacies: Pharmacy[],
  defaultYear: number,
): ParsedLine[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((raw) => {
      // fecha al inicio: 15/8, 15-08, 15/08/2026...
      const m = raw.match(/^(\d{1,2})[\/\-.](\d{1,2})(?:[\/\-.](\d{2,4}))?/);
      if (!m) {
        return {
          raw,
          date: null,
          pharmacy: null,
          error: "No encuentro la fecha al inicio (formato: 15/08 Nombre)",
        };
      }

      const day = Number(m[1]);
      const month = Number(m[2]);
      let year = m[3] ? Number(m[3]) : defaultYear;
      if (year < 100) year += 2000;

      if (month < 1 || month > 12 || day < 1 || day > 31) {
        return { raw, date: null, pharmacy: null, error: "Fecha inválida" };
      }

      const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const rest = raw.slice(m[0].length).replace(/^[\s:;,\-–—.]+/, "");
      const pharmacy = matchPharmacy(rest, pharmacies);

      return {
        raw,
        date,
        pharmacy,
        error: pharmacy
          ? null
          : `No matchea ninguna farmacia cargada: «${rest}»`,
      };
    });
}

export default function BulkTurnsLoader({ pharmacies }: Props) {
  const [text, setText] = useState("");
  const [startTime, setStartTime] = useState("08:30");
  const [durationHours, setDurationHours] = useState(24);
  const [parsed, setParsed] = useState<ParsedLine[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [overlapWarning, setOverlapWarning] = useState<string | null>(null);

  const analyze = async () => {
    const lines = parseLines(text, pharmacies, new Date().getFullYear());
    setParsed(lines);
    setResult(null);
    setOverlapWarning(null);

    // Aviso si ya hay turnos cargados en el rango de fechas pegado
    const dates = lines.map((l) => l.date).filter(Boolean) as string[];
    if (dates.length > 0) {
      const min = `${dates.reduce((a, b) => (a < b ? a : b))}T00:00:00-03:00`;
      const max = `${dates.reduce((a, b) => (a > b ? a : b))}T23:59:59-03:00`;
      const { count } = await supabaseBrowser
        .from("pharmacy_turns")
        .select("id", { count: "exact", head: true })
        .gte("starts_at", new Date(min).toISOString())
        .lte("starts_at", new Date(max).toISOString());
      if (count && count > 0) {
        setOverlapWarning(
          `⚠️ Ojo: ya hay ${count} turno(s) cargados en ese rango de fechas. Si estás recargando el mismo mes, borralos primero para no duplicar.`,
        );
      }
    }
  };

  const load = async () => {
    if (!parsed) return;
    const valid = parsed.filter((l) => l.date && l.pharmacy);
    if (valid.length === 0) return;

    setLoading(true);
    setResult(null);

    const rows = valid.map((l) => {
      const starts = new Date(`${l.date}T${startTime}:00-03:00`);
      const ends = new Date(starts.getTime() + durationHours * 3600000);
      return {
        pharmacy_id: l.pharmacy!.id,
        starts_at: starts.toISOString(),
        ends_at: ends.toISOString(),
      };
    });

    const { error } = await supabaseBrowser.from("pharmacy_turns").insert(rows);

    if (error) {
      console.error(error);
      setResult(`❌ Error cargando: ${error.message}`);
    } else {
      setResult(`✅ ${rows.length} turnos cargados. Recargando…`);
      setTimeout(() => window.location.reload(), 1200);
    }
    setLoading(false);
  };

  const validCount = parsed?.filter((l) => l.date && l.pharmacy).length ?? 0;
  const errorCount = (parsed?.length ?? 0) - validCount;

  return (
    <details className="rounded-2xl border border-primary/30 bg-primary-soft/30">
      <summary className="cursor-pointer px-5 py-4 font-semibold text-gray-800">
        ⚡ Carga masiva (pegar la lista del mes)
      </summary>

      <div className="space-y-4 border-t border-primary/20 p-5">
        <p className="text-sm text-gray-600">
          Pegá una línea por turno:{" "}
          <strong>fecha + nombre de la farmacia</strong>. El nombre no necesita
          ser exacto, lo matcheamos contra tus farmacias.
        </p>

        <textarea
          rows={8}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setParsed(null);
          }}
          placeholder={
            "15/08 Bernachea\n16/08 Farmacia Ríos\n17/08 Schinca\n18/08 Tantone…"
          }
          className="w-full rounded-xl border border-gray-200 bg-white p-3 font-mono text-sm focus:border-primary focus:outline-none"
        />

        <div className="flex flex-wrap items-end gap-4">
          <label className="text-sm text-gray-600">
            Cada turno empieza a las
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="ml-2 rounded-lg border border-gray-200 bg-white px-2 py-1.5"
            />
          </label>
          <label className="text-sm text-gray-600">
            y dura
            <input
              type="number"
              min={1}
              max={72}
              value={durationHours}
              onChange={(e) => setDurationHours(Number(e.target.value))}
              className="mx-2 w-16 rounded-lg border border-gray-200 bg-white px-2 py-1.5"
            />
            horas
          </label>

          <button
            onClick={analyze}
            disabled={!text.trim()}
            className="rounded-xl bg-secondary px-5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            Analizar lista
          </button>
        </div>

        {overlapWarning && (
          <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-700">
            {overlapWarning}
          </p>
        )}

        {parsed && (
          <div className="space-y-3">
            <ul className="max-h-64 space-y-1 overflow-y-auto">
              {parsed.map((l, i) => (
                <li
                  key={i}
                  className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm ${
                    l.error ? "bg-red-50 text-red-700" : "bg-white"
                  }`}
                >
                  {l.error ? (
                    <>
                      <span>✗</span>
                      <span className="font-mono text-xs">{l.raw}</span>
                      <span className="text-xs">— {l.error}</span>
                    </>
                  ) : (
                    <>
                      <span className="text-green-600">✓</span>
                      <span className="font-semibold">
                        {new Date(`${l.date}T12:00:00`).toLocaleDateString(
                          "es-AR",
                          { weekday: "short", day: "numeric", month: "short" },
                        )}
                      </span>
                      → {l.pharmacy!.name}
                    </>
                  )}
                </li>
              ))}
            </ul>

            <div className="flex items-center gap-3">
              <button
                onClick={load}
                disabled={loading || validCount === 0}
                className="rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
              >
                {loading
                  ? "Cargando…"
                  : `Cargar ${validCount} turno${validCount === 1 ? "" : "s"}`}
              </button>
              {errorCount > 0 && (
                <span className="text-sm text-red-600">
                  {errorCount} línea{errorCount === 1 ? "" : "s"} con error (no
                  se cargan — corregilas y volvé a analizar)
                </span>
              )}
            </div>
          </div>
        )}

        {result && (
          <p className="rounded-xl bg-white p-3 text-sm font-semibold">
            {result}
          </p>
        )}
      </div>
    </details>
  );
}
