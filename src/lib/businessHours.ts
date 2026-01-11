type BusinessHour = {
  day_of_week: number; // 0 domingo - 6 sábado
  open_time: string | null; // "09:00:00"
  close_time: string | null;
  is_closed: boolean;
};

export function getBusinessStatus(hours: BusinessHour[]) {
  const now = new Date();
  const currentDay = now.getDay();
  const currentTime = now.toTimeString().slice(0, 8);

  const today = hours.find((h) => h.day_of_week === currentDay);

  // Si hoy no abre
  if (!today || today.is_closed || !today.open_time || !today.close_time) {
    const nextOpen = getNextOpenDay(hours, currentDay);
    return {
      is_open: false,
      label: nextOpen ? `Cerrado · Abre ${nextOpen}` : "Cerrado",
    };
  }

  // Está abierto ahora
  if (currentTime >= today.open_time && currentTime <= today.close_time) {
    return {
      is_open: true,
      label: `Abierto · Cierra a las ${today.close_time.slice(0, 5)}`,
    };
  }

  // Está cerrado pero abre hoy
  if (currentTime < today.open_time) {
    return {
      is_open: false,
      label: `Cerrado · Abre hoy a las ${today.open_time.slice(0, 5)}`,
    };
  }

  // Cerró por hoy → buscar próximo día
  const nextOpen = getNextOpenDay(hours, currentDay);
  return {
    is_open: false,
    label: nextOpen ? `Cerrado · Abre ${nextOpen}` : "Cerrado",
  };
}

function getNextOpenDay(hours: BusinessHour[], fromDay: number) {
  for (let i = 1; i <= 7; i++) {
    const day = (fromDay + i) % 7;
    const h = hours.find(
      (d) => d.day_of_week === day && !d.is_closed && d.open_time
    );

    if (h) {
      return `${dayName(day)} a las ${h.open_time!.slice(0, 5)}`;
    }
  }
  return null;
}

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
