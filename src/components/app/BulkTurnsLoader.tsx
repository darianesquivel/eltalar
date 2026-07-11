import { useState } from "react";
import { supabaseBrowser } from "../../lib/supabase/browser";

type Pharmacy = {
  id: string;
  name: string;
};

type Props = {
  pharmacies: Pharmacy[];
};

type ParsedEntry = {
  name: string;
  pharmacy: Pharmacy | null;
};

type ParsedLine = {
  raw: string;
  date: string | null; // "2026-07-01"
  weekdayWarn: string | null;
  entries: ParsedEntry[];
  error: string | null;
};

const MONTHS = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

const WEEKDAYS = ["dom", "lun", "mar", "mie", "jue", "vie", "sab"];

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

  let hit = pharmacies.find((p) => norm(p.name) === target);
  if (hit) return hit;

  const candidates = pharmacies.filter((p) => {
    const n = norm(p.name);
    return n.includes(target) || target.includes(n);
  });
  if (candidates.length === 1) return candidates[0];
  if (candidates.length > 1) {
    candidates.sort((a, b) => norm(a.name).length - norm(b.name).length);
    return candidates[0];
  }

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
  month: number, // 1-12 (para líneas sin mes)
  year: number,
): ParsedLine[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((raw): ParsedLine => {
      let day: number, m: number, y: number;
      let rest: string;

      // Fecha completa (15/08, 15-08-2026) o solo el día (01, 15)
      const full = raw.match(/^(\d{1,2})[\/\-.](\d{1,2})(?:[\/\-.](\d{2,4}))?/);
      const dayOnly = raw.match(/^(\d{1,2})\b/);

      if (full) {
        day = Number(full[1]);
        m = Number(full[2]);
        y = full[3] ? Number(full[3]) : year;
        if (y < 100) y += 2000;
        rest = raw.slice(full[0].length);
      } else if (dayOnly) {
        day = Number(dayOnly[1]);
        m = month;
        y = year;
        rest = raw.slice(dayOnly[0].length);
      } else {
        return {
          raw,
          date: null,
          weekdayWarn: null,
          entries: [],
          error: "No encuentro el día al inicio de la línea",
        };
      }

      if (m < 1 || m > 12 || day < 1 || day > 31) {
        return {
          raw,
          date: null,
          weekdayWarn: null,
          entries: [],
          error: "Fecha inválida",
        };
      }

      const date = `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

      // Día de la semana declarado en la línea ("Mié:", "sab", ...) → validarlo
      let weekdayWarn: string | null = null;
      const wd = rest.match(
        /^\s*(dom|lun|mar|mi[eé]|jue|vie|s[aá]b)[a-zé.]*\s*/i,
      );
      if (wd) {
        const declared = norm(wd[1]).replace(/\s/g, "").slice(0, 3);
        const realDay = new Date(`${date}T12:00:00`).getDay();
        if (WEEKDAYS[realDay] !== declared) {
          weekdayWarn = `La línea dice "${wd[1]}" pero el ${day}/${m}/${y} cae ${WEEKDAYS[realDay]} — ¿elegiste bien el mes?`;
        }
        rest = rest.slice(wd[0].length);
      }

      rest = rest.replace(/^[\s:;,\-–—.]+/, "");

      // Varias farmacias por turno, separadas por " - ", "," o ";"
      const names = rest
        .split(/\s+[-–—]\s+|\s*[,;]\s*/)
        .map((n) => n.trim())
        .filter(Boolean);

      if (names.length === 0) {
        return {
          raw,
          date,
          weekdayWarn,
          entries: [],
          error: "No hay farmacias en la línea",
        };
      }

      const entries = names.map((name) => ({
        name,
        pharmacy: matchPharmacy(name, pharmacies),
      }));

      return { raw, date, weekdayWarn, entries, error: null };
    });
}

export default function BulkTurnsLoader({ pharmacies }: Props) {
  const now = new Date();
  const [text, setText] = useState("");
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [startTime, setStartTime] = useState("08:30");
  const [durationHours, setDurationHours] = useState(24);
  const [parsed, setParsed] = useState<ParsedLine[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [overlapWarning, setOverlapWarning] = useState<string | null>(null);

  const analyze = async () => {
    const lines = parseLines(text, pharmacies, month, year);
    setParsed(lines);
    setResult(null);
    setOverlapWarning(null);

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

  const validTurns = (parsed ?? []).flatMap((l) =>
    l.date
      ? l.entries
          .filter((e) => e.pharmacy)
          .map((e) => ({ date: l.date!, pharmacy: e.pharmacy! }))
      : [],
  );
  const unmatchedCount = (parsed ?? []).reduce(
    (acc, l) => acc + l.entries.filter((e) => !e.pharmacy).length,
    0,
  );
  const badLines = (parsed ?? []).filter((l) => l.error).length;
  const weekdayWarns = (parsed ?? []).filter((l) => l.weekdayWarn).length;

  const load = async () => {
    if (validTurns.length === 0) return;
    setLoading(true);
    setResult(null);

    const rows = validTurns.map((t) => {
      const starts = new Date(`${t.date}T${startTime}:00-03:00`);
      const ends = new Date(starts.getTime() + durationHours * 3600000);
      return {
        pharmacy_id: t.pharmacy.id,
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

  const inputClass = "field w-auto";

  return (
    <details className="rounded-2xl border border-primary/30 bg-primary-soft/30">
      <summary className="cursor-pointer px-5 py-4 font-semibold text-gray-800">
        ⚡ Carga masiva (pegar la lista del mes)
      </summary>

      <div className="space-y-4 border-t border-primary/20 p-5">
        <p className="text-sm text-gray-600">
          Pegá la lista tal cual sale publicada, una línea por día. Acepta
          formatos como <code>01 Mié: Farmacia A - Farmacia B</code> o{" "}
          <code>15/08 Nombre</code>. Si la línea tiene varias farmacias
          separadas por «-», se carga un turno para cada una.
        </p>

        <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
          Mes de la lista:
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className={`${inputClass} select-field`}
          >
            {MONTHS.map((name, i) => (
              <option key={name} value={i + 1}>
                {name}
              </option>
            ))}
          </select>
          <input
            type="number"
            value={year}
            min={2024}
            max={2100}
            onChange={(e) => setYear(Number(e.target.value))}
            className={`${inputClass} w-24`}
          />
        </div>

        <textarea
          rows={10}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setParsed(null);
          }}
          placeholder={
            "01 Mié: Gral. Pacheco SCS - Lauría - Schinca SCS\n02 Jue: Gasparín - Rios - Bernachea\n…"
          }
          className="field font-mono"
        />

        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
          <label>
            Cada turno empieza a las
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className={`${inputClass} ml-2`}
            />
          </label>
          <label>
            y dura
            <input
              type="number"
              min={1}
              max={72}
              value={durationHours}
              onChange={(e) => setDurationHours(Number(e.target.value))}
              className={`${inputClass} mx-2 w-16`}
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
            <ul className="max-h-72 space-y-1 overflow-y-auto">
              {parsed.map((l, i) => (
                <li
                  key={i}
                  className={`rounded-lg px-3 py-1.5 text-sm ${
                    l.error ? "bg-red-50 text-red-700" : "bg-white"
                  }`}
                >
                  {l.error ? (
                    <>
                      <span className="font-mono text-xs">{l.raw}</span>
                      <span className="text-xs"> — {l.error}</span>
                    </>
                  ) : (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-semibold">
                        {new Date(`${l.date}T12:00:00`).toLocaleDateString(
                          "es-AR",
                          { weekday: "short", day: "numeric", month: "short" },
                        )}
                      </span>
                      {l.entries.map((e, j) => (
                        <span
                          key={j}
                          className={`rounded-full px-2 py-0.5 text-xs ${
                            e.pharmacy
                              ? "bg-green-100 text-green-700"
                              : "bg-red-100 text-red-700"
                          }`}
                          title={e.pharmacy ? e.pharmacy.name : "sin match"}
                        >
                          {e.pharmacy ? `✓ ${e.pharmacy.name}` : `✗ ${e.name}`}
                        </span>
                      ))}
                      {l.weekdayWarn && (
                        <span className="w-full text-xs text-amber-600">
                          ⚠️ {l.weekdayWarn}
                        </span>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={load}
                disabled={loading || validTurns.length === 0}
                className="rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
              >
                {loading
                  ? "Cargando…"
                  : `Cargar ${validTurns.length} turno${validTurns.length === 1 ? "" : "s"}`}
              </button>
              {unmatchedCount > 0 && (
                <span className="text-sm text-red-600">
                  {unmatchedCount} farmacia(s) sin match (no se cargan; crealas
                  como negocio o corregí el nombre)
                </span>
              )}
              {badLines > 0 && (
                <span className="text-sm text-red-600">
                  {badLines} línea(s) ilegibles
                </span>
              )}
              {weekdayWarns > 0 && (
                <span className="text-sm text-amber-600">
                  {weekdayWarns} advertencia(s) de día de semana
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
