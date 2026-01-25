type TodayStatus =
  | { status: "open"; label: string }
  | { status: "closed"; label: string }
  | { status: "not_configured"; label: string }
  | null;

/* ======================
   HELPERS
====================== */

function dayName(day: number) {
  return [
    "domingo",
    "lunes",
    "martes",
    "miércoles",
    "jueves",
    "viernes",
    "sábado",
  ][day];
}

function getNextOpenRange(hours: any[], fromDay: number) {
  console.log({ hours, fromDay });
  for (let i = 1; i <= 6; i++) {
    const day = (fromDay + i) % 7;

    const h = hours.find(
      (x) =>
        x.day_of_week === day &&
        x.is_closed === false &&
        (x.is_open_24 === true || x.open_time != null),
    );

    console.log("H", h);

    if (!h) continue;

    if (h.is_open_24) {
      return `${dayName(day)} 24hs`;
    }

    return `${dayName(day)} ${h.open_time.slice(0, 5)}`;
  }

  return null;
}

export function getTodayBusinessStatus(business: any): TodayStatus {
  const hours = business.business_hours;
  if (!hours || hours.length === 0) return null;

  const now = new Date();
  const today = now.getDay();
  const currentTime = now.toTimeString().slice(0, 5);

  const todayHours = hours
    .filter((h: any) => h.day_of_week === today)
    .sort((a: any, b: any) =>
      (a.open_time ?? "").localeCompare(b.open_time ?? ""),
    );

  if (todayHours.length === 0) {
    const next = getNextOpenRange(hours, today);
    return next ? { status: "not_configured", label: `Abre ${next}` } : null;
  }

  if (todayHours.some((h: any) => h.is_closed)) {
    const next = getNextOpenRange(hours, today);
    return {
      status: "closed",
      label: next ? `Cerrado · Abre ${next}` : "Cerrado",
    };
  }

  const open24 = todayHours.some((h: any) => h.is_open_24 && !h.is_closed);

  if (open24) {
    return {
      status: "open",
      label: "Abierto · 24 horas",
    };
  }

  for (const h of todayHours) {
    if (!h.open_time || !h.close_time) continue;

    const open = h.open_time.slice(0, 5);
    const close = h.close_time.slice(0, 5);

    if (currentTime >= open && currentTime <= close) {
      return {
        status: "open",
        label: `Abierto · Cierra ${close}`,
      };
    }

    if (currentTime < open) {
      return {
        status: "closed",
        label: `Cerrado · Abre hoy ${open}`,
      };
    }
  }

  const next = getNextOpenRange(hours, today);
  return {
    status: "closed",
    label: next ? `Cerrado · Abre ${next}` : "Cerrado",
  };
}
