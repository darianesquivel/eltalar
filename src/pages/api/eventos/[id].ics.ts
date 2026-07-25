import type { APIRoute } from "astro";
import { getEventById } from "../../../lib/repositories/event.repository";

/**
 * Archivo .ics para el botón "Agendar" de la agenda de eventos.
 * GET /api/eventos/<id>.ics
 *
 * Argentina no tiene horario de verano: el offset es siempre -03:00, así que
 * pasar los horarios a UTC es una suma exacta, sin librería de timezones.
 */

const AR_OFFSET = "-03:00";

const toUtcStamp = (date: string, time: string | null, addHours = 0) => {
  const iso = `${date}T${(time ?? "00:00:00").slice(0, 8)}${AR_OFFSET}`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    // Hora malformada en la base: mejor un .ics sin hora exacta que un 500
    throw new Error(`Fecha/hora inválida: ${date} ${time}`);
  }
  d.setUTCHours(d.getUTCHours() + addHours);
  return `${d.toISOString().replace(/[-:]/g, "").split(".")[0]}Z`;
};

/** Fecha suelta (evento de día completo): el DTEND es exclusivo, va +1 día. */
const toDateStamp = (date: string, addDays = 0) => {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + addDays);
  return d.toISOString().slice(0, 10).replace(/-/g, "");
};

// Saltos de línea, comas y punto y coma tienen significado en el formato
const escape = (value: string) =>
  value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");

export const GET: APIRoute = async ({ params, locals, url }) => {
  const id = params.id;
  if (!id) return new Response("Not found", { status: 404 });

  const event = await getEventById(id, locals.barrio.id);
  if (!event) return new Response("Not found", { status: 404 });

  const endDate = event.end_date ?? event.date;

  // Sin hora de cierre, el evento dura 1 hora: DTEND igual a DTSTART crea
  // una entrada de duración cero que algunos calendarios muestran mal.
  let timing: string[];
  try {
    timing = event.start_time
      ? [
          `DTSTART:${toUtcStamp(event.date, event.start_time)}`,
          event.end_time
            ? `DTEND:${toUtcStamp(endDate, event.end_time)}`
            : `DTEND:${toUtcStamp(endDate, event.start_time, 1)}`,
        ]
      : [
          `DTSTART;VALUE=DATE:${toDateStamp(event.date)}`,
          `DTEND;VALUE=DATE:${toDateStamp(endDate, 1)}`,
        ];
  } catch (err) {
    // Hora malformada: se cae al evento de día completo en vez de un 500
    console.error("ICS con horario inválido:", err);
    timing = [
      `DTSTART;VALUE=DATE:${toDateStamp(event.date)}`,
      `DTEND;VALUE=DATE:${toDateStamp(endDate, 1)}`,
    ];
  }

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//${locals.barrio.name}//Agenda//ES`,
    "BEGIN:VEVENT",
    `UID:${event.id}@${new URL(locals.barrio.url).hostname}`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").split(".")[0]}Z`,
    ...timing,
    `SUMMARY:${escape(event.title)}`,
    ...(event.location ? [`LOCATION:${escape(event.location)}`] : []),
    ...(event.description ? [`DESCRIPTION:${escape(event.description)}`] : []),
    `URL:${new URL("/eventos", url.origin).toString()}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  // RFC 5545: ninguna línea puede pasar los 75 octetos; las que siguen
  // arrancan con un espacio. Sin esto, una descripción larga rompe
  // los parsers estrictos.
  // Se corta cada 60 caracteres y no cada 74: el límite es en octetos y los
  // acentos ocupan dos, así que con texto en castellano 74 se pasa.
  const fold = (line: string) =>
    line.length <= 60 ? line : (line.match(/.{1,60}/g) ?? [line]).join("\r\n ");

  return new Response(`${lines.map(fold).join("\r\n")}\r\n`, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="evento-${event.id}.ics"`,
    },
  });
};
