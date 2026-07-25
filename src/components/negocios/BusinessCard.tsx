import { navigate } from "astro:transitions/client";
import { MapPin, Phone, Star } from "lucide-react";
import { getTodayStatus } from "../../lib/hours";
import { cdnImage } from "../../lib/images";
import { track } from "../../lib/track";
import type { BusinessSummary } from "../../lib/repositories/business.repository";

type BusinessCardProps = {
  business: BusinessSummary;
};

const wspLogo = "/images/whatsapp-icon.svg";

const CHIP = "rounded-full px-2.5 py-1.5 text-[11.5px] font-bold leading-none";

export default function BusinessCard({ business }: BusinessCardProps) {
  const status = getTodayStatus(business.business_hours);
  const href = `/negocios/${business.slug}`;
  const category = business.categories[0];

  const whatsappUrl = `https://wa.me/${business.whatsapp}?text=${encodeURIComponent(
    business.whatsapp_message ?? "",
  )}`;
  const hasContact = Boolean(business.whatsapp || business.phone);
  const mapsUrl = business.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(business.address)}`
    : null;

  // navigate() usa el router de Astro: dispara la barra de progreso global
  // y las view transitions, en vez de una recarga completa sin feedback.
  const openDetail = () => navigate(href);
  // Los botones de contacto no tienen que arrastrar a la ficha
  const stop = (e: React.MouseEvent) => e.stopPropagation();

  const statusChip = business.by_appointment
    ? { text: "Atiende con turno", className: "bg-[#e7f0f8] text-info" }
    : status?.status === "open"
      ? { text: status.label, className: "bg-primary-soft text-primary-strong" }
      : status?.status === "closed"
        ? { text: status.label, className: "bg-[#f7eceb] text-error" }
        : status
          ? { text: status.label, className: "bg-bg-muted text-text-body" }
          : null;

  return (
    <div
      onClick={openDetail}
      className="flex cursor-pointer flex-col overflow-hidden rounded-[20px] bg-bg-card shadow-card transition-colors"
    >
      {/* PORTADA */}
      <div className="relative">
        {business.coverPhoto?.url ? (
          <img
            src={cdnImage(business.coverPhoto.url, 640) ?? undefined}
            alt={business.name}
            width={400}
            height={158}
            loading="lazy"
            decoding="async"
            className="h-[130px] w-full object-cover sm:h-[158px]"
          />
        ) : (
          <div
            role="img"
            aria-label={business.name}
            className="img-placeholder h-[130px] w-full sm:h-[158px]"
          />
        )}

        <div className="absolute inset-x-0 top-0 flex items-start justify-between p-3">
          {category && (
            <span className={`${CHIP} bg-white text-text-main shadow-soft`}>
              {category.name}
            </span>
          )}

          {/* Con reseñas publicadas manda el puntaje; si no, el Destacado */}
          {business.rating_count > 0 && business.rating_avg ? (
            <span
              className={`${CHIP} ml-auto inline-flex items-center gap-1 bg-white text-text-main shadow-soft`}
            >
              <Star size={12} className="fill-rating text-rating" />
              {business.rating_avg.toFixed(1)}
            </span>
          ) : (
            business.is_featured && (
              <span
                className={`${CHIP} ml-auto inline-flex items-center gap-1 bg-white text-text-main shadow-soft`}
              >
                <Star size={12} className="fill-rating text-rating" />
                Destacado
              </span>
            )
          )}
        </div>
      </div>

      {/* CUERPO */}
      <div className="flex flex-1 flex-col gap-[7px] p-4 sm:px-[18px]">
        <h3 className="line-clamp-1 text-[17px] font-bold leading-tight text-text-main sm:text-[19px]">
          <a href={href} onClick={stop}>
            {business.name}
          </a>
        </h3>

        <div className="flex flex-wrap items-center gap-1.5">
          {statusChip && (
            <span
              className={`inline-flex items-center gap-1.5 text-[12.5px] font-semibold ${statusChip.className} rounded-full px-2.5 py-1`}
            >
              <span className="size-1.5 rounded-full bg-current" />
              {statusChip.text}
            </span>
          )}

          {business.offers?.length > 0 && (
            <span className="rounded-full bg-offer px-2.5 py-1 text-[12.5px] font-semibold text-white">
              {business.offers.length > 1
                ? `${business.offers.length} ofertas`
                : "Oferta"}
            </span>
          )}
        </div>

        {business.description && (
          <p className="line-clamp-2 text-[13.5px] leading-normal text-text-body">
            {business.description}
          </p>
        )}

        {(business.address || business.rating_count > 0) && (
          <p className="line-clamp-1 text-[12.5px] text-text-muted">
            {[
              business.address,
              business.rating_count > 0
                ? `${business.rating_count} ${business.rating_count === 1 ? "reseña" : "reseñas"}`
                : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        )}

        {/* ACCIONES — SIEMPRE ABAJO */}
        <div className="mt-auto flex gap-2 pt-3">
          {business.whatsapp ? (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                stop(e);
                track(business.id, "whatsapp");
              }}
              className="flex flex-1 items-center justify-center gap-[7px] rounded-xl bg-primary p-3 text-[13px] font-semibold text-white transition-colors hover:bg-primary-hover"
            >
              <img
                src={wspLogo}
                width={15}
                alt=""
                className="brightness-0 invert"
              />
              WhatsApp
            </a>
          ) : (
            // Sin WhatsApp, el botón principal es el teléfono: la card no
            // queda con una fila de cuadraditos sueltos
            business.phone && (
              <a
                href={`tel:${business.phone}`}
                onClick={(e) => {
                  stop(e);
                  track(business.id, "phone");
                }}
                className="flex flex-1 items-center justify-center gap-[7px] rounded-xl bg-primary p-3 text-[13px] font-semibold text-white transition-colors hover:bg-primary-hover"
              >
                <Phone size={15} />
                Llamar
              </a>
            )
          )}

          {business.whatsapp && business.phone && (
            <a
              href={`tel:${business.phone}`}
              aria-label={`Llamar a ${business.name}`}
              onClick={(e) => {
                stop(e);
                track(business.id, "phone");
              }}
              className="flex items-center rounded-xl bg-primary-faint px-[13px] py-3 transition-colors hover:bg-primary-soft"
            >
              <Phone size={16} className="text-text-main" />
            </a>
          )}

          {mapsUrl && (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Cómo llegar a ${business.name}`}
              onClick={stop}
              className={`flex items-center justify-center gap-[7px] rounded-xl bg-primary-faint py-3 text-[13px] font-semibold text-text-main transition-colors hover:bg-primary-soft ${
                hasContact ? "px-[13px]" : "flex-1"
              }`}
            >
              <MapPin size={16} className="text-text-main" />
              {!hasContact && "Cómo llegar"}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
