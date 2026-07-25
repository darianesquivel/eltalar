/**
 * Módulo único de horarios de negocios.
 *
 * Reemplaza a businessHours.ts, getTodayBusinessStatus.ts y getBusinessHours.ts,
 * que tenían la misma lógica triplicada.
 *
 * Todos los cálculos usan la hora de Argentina de forma explícita: este código
 * corre tanto en el navegador del visitante como en servidores de Vercel (UTC),
 * y `new Date().getDay()` / `toTimeString()` devuelven la hora LOCAL de quien
 * ejecuta — en un server UTC el "abierto/cerrado" quedaría corrido 3 horas.
 */

export const ARGENTINA_TZ = "America/Argentina/Buenos_Aires";

export type BusinessHour = {
  day_of_week: number; // 0 domingo - 6 sábado
  open_time: string | null; // "09:00:00"
  close_time: string | null;
  is_closed: boolean | null;
  is_open_24?: boolean | null;
};

export type TodayStatus =
  | { status: "open"; label: string }
  | { status: "closed"; label: string }
  | { status: "not_configured"; label: string }
  | null;

export type DaySchedule = {
  label: string;
  isToday: boolean;
  status: "open" | "closed" | "open_24" | "not_loaded";
  ranges?: { open: string; close: string }[];
};

const DAY_NAMES = [
  "domingo",
  "lunes",
  "martes",
  "miércoles",
  "jueves",
  "viernes",
  "sábado",
];

const dayName = (day: number) => DAY_NAMES[day];

/** Fecha de hoy en Argentina como "YYYY-MM-DD" (para vencimientos). */
export function todayInArgentina(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ARGENTINA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Día de la semana (0-6) y hora "HH:MM" actuales en Argentina. */
export function nowInArgentina() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ARGENTINA_TZ,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";

  const dayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  return {
    day: dayMap[get("weekday")] ?? new Date().getDay(),
    time: `${get("hour")}:${get("minute")}`,
  };
}

/**
 * ¿Un tramo de HOY está abierto a la hora dada?
 * Soporta horarios nocturnos (20:00–02:00): después de la apertura se
 * considera abierto aunque el cierre caiga en el día siguiente (ese caso
 * lo cubre openFromYesterday cuando ya pasó la medianoche).
 */
export function openNowToday(h: BusinessHour, time: string): boolean {
  if (h.is_closed) return false;
  if (h.is_open_24) return true;
  if (!h.open_time || !h.close_time) return false;
  const open = h.open_time.slice(0, 5);
  const close = h.close_time.slice(0, 5);
  return close < open ? time >= open : time >= open && time <= close;
}

/** Tramo nocturno de AYER que sigue abierto (cierra de madrugada). */
export function openFromYesterday(h: BusinessHour, time: string): boolean {
  if (h.is_closed || h.is_open_24 || !h.open_time || !h.close_time)
    return false;
  const open = h.open_time.slice(0, 5);
  const close = h.close_time.slice(0, 5);
  return close < open && time <= close;
}

function getNextOpenRange(hours: BusinessHour[], fromDay: number) {
  for (let i = 1; i <= 7; i++) {
    const day = (fromDay + i) % 7;

    const h = hours.find(
      (x) =>
        x.day_of_week === day &&
        !x.is_closed &&
        (x.is_open_24 === true || x.open_time != null),
    );

    if (!h) continue;

    if (h.is_open_24) {
      return `${dayName(day)} 24hs`;
    }

    return `${dayName(day)} ${h.open_time!.slice(0, 5)}`;
  }

  return null;
}

/** Estado actual del negocio: badge "Abierto · Cierra 20:00" / "Cerrado · Abre ...". */
export function getTodayStatus(
  hours: BusinessHour[] | null | undefined,
): TodayStatus {
  if (!hours || hours.length === 0) return null;

  const { day: today, time: currentTime } = nowInArgentina();

  // Tramo nocturno de ayer (p.ej. viernes 20:00–02:00, y son las 01:00 del
  // sábado): sigue abierto, sin importar qué diga la fila de hoy.
  const yesterday = (today + 6) % 7;
  const overnight = hours.find(
    (h) => h.day_of_week === yesterday && openFromYesterday(h, currentTime),
  );
  if (overnight) {
    return {
      status: "open",
      label: `Abierto · Cierra ${overnight.close_time!.slice(0, 5)}`,
    };
  }

  const todayHours = hours
    .filter((h) => h.day_of_week === today)
    .sort((a, b) => (a.open_time ?? "").localeCompare(b.open_time ?? ""));

  if (todayHours.length === 0) {
    const next = getNextOpenRange(hours, today);
    return next ? { status: "not_configured", label: `Abre ${next}` } : null;
  }

  if (todayHours.some((h) => h.is_closed)) {
    const next = getNextOpenRange(hours, today);
    return {
      status: "closed",
      label: next ? `Cerrado · Abre ${next}` : "Cerrado",
    };
  }

  if (todayHours.some((h) => h.is_open_24 && !h.is_closed)) {
    return { status: "open", label: "Abierto · 24 horas" };
  }

  for (const h of todayHours) {
    if (!h.open_time || !h.close_time) continue;

    const open = h.open_time.slice(0, 5);
    const close = h.close_time.slice(0, 5);

    if (openNowToday(h, currentTime)) {
      return { status: "open", label: `Abierto · Cierra ${close}` };
    }

    if (currentTime < open) {
      return { status: "closed", label: `Cerrado · Abre hoy ${open}` };
    }
  }

  const next = getNextOpenRange(hours, today);
  return {
    status: "closed",
    label: next ? `Cerrado · Abre ${next}` : "Cerrado",
  };
}

/** Grilla semanal de horarios para la ficha del negocio. */
export function getWeekSchedule(
  hours: BusinessHour[] | null | undefined,
): DaySchedule[] {
  const { day: today } = nowInArgentina();

  return DAY_NAMES.map((name, index) => {
    const label = name.charAt(0).toUpperCase() + name.slice(1);
    const isToday = index === today;
    const dayHours = hours?.filter((h) => h.day_of_week === index) ?? [];

    if (dayHours.length === 0) {
      return { label, isToday, status: "not_loaded" as const };
    }

    if (dayHours.some((h) => h.is_open_24)) {
      return { label, isToday, status: "open_24" as const };
    }

    if (dayHours.some((h) => h.is_closed)) {
      return { label, isToday, status: "closed" as const };
    }

    return {
      label,
      isToday,
      status: "open" as const,
      ranges: dayHours
        .filter((h) => h.open_time && h.close_time)
        .map((h) => ({
          open: h.open_time!.slice(0, 5),
          close: h.close_time!.slice(0, 5),
        })),
    };
  });
}
