import { navigate } from "astro:transitions/client";
import { BadgeCheck, PhoneCall } from "lucide-react";
import CategoryPlaceholder from "./CategoryPlaceholder";
import InstagramIcon from "../icons/InstagramIcon";
import { getTodayStatus } from "../../lib/hours";
import { instagramUrl } from "../../lib/links";
import { track } from "../../lib/track";
import { optimizedImage } from "../../lib/images";
import type { BusinessSummary } from "../../lib/repositories/business.repository";

type BusinessCardProps = {
  business: BusinessSummary;
};

const wspLogo = "/images/whatsapp-icon.svg";

export default function BusinessCard({ business }: BusinessCardProps) {
  const status = getTodayStatus(business.business_hours);

  const whatsappUrl = `https://wa.me/${business.whatsapp}?text=${encodeURIComponent(
    business.whatsapp_message ?? "",
  )}`;

  // navigate() usa el router de Astro: dispara la barra de progreso global
  // y las view transitions, en vez de una recarga completa sin feedback.
  const handleClick = () => {
    navigate(`/negocios/${business.slug}`);
  };

  return (
    <div
      data-tilt
      className="flex flex-col rounded-xl bg-white shadow-lg overflow-hidden"
    >
      {/* IMAGE */}
      <div className="relative " onClick={handleClick}>
        {business.offers?.length > 0 && (
          <span className="absolute right-2 top-2 z-10 inline-flex items-center gap-1 rounded-full bg-orange-500 px-2.5 py-0.5 text-xs font-bold text-white shadow">
            🔥 Oferta
          </span>
        )}
        <div className="absolute top-1.5 left-1.5 z-10 flex flex-wrap gap-1">
          {business.categories.map((category) => (
            <span
              key={category.id}
              className="text-[10px] px-2 bg-primary text-white rounded-full border border-white/30"
            >
              {category.name}
            </span>
          ))}
        </div>

        {business.coverPhoto?.url ? (
          <img
            src={optimizedImage(business.coverPhoto.url, 480)}
            alt={business.name}
            width={400}
            height={112}
            loading="lazy"
            decoding="async"
            className="h-28 w-full object-cover cursor-pointer"
          />
        ) : (
          <CategoryPlaceholder
            categorySlug={business.categories[0]?.slug}
            label={business.name}
            iconSize={24}
            className="h-28 w-full cursor-pointer"
          />
        )}
      </div>

      {/* CONTENT */}
      <div className="flex flex-col p-2.5 flex-1">
        {/* TOP INFO */}
        <div>
          {/* NAME */}
          <div className="flex items-center gap-1.5">
            <h3 className="text-sm font-semibold text-gray-900 line-clamp-1">
              {business.name}
            </h3>

            {business.is_featured && (
              <BadgeCheck size={15} className="shrink-0 text-services" />
            )}
          </div>

          {/* STATUS: con turno no hay abierto/cerrado */}
          {business.by_appointment ? (
            <span className="text-[10px] uppercase text-services">
              ● Atiende con turno
            </span>
          ) : (
            status && (
              <span
                className={`text-[10px] uppercase ${
                  status.status === "open"
                    ? "text-green-600"
                    : status.status === "closed"
                      ? "text-red-500"
                      : "text-gray-500"
                }`}
              >
                ● {status.label}
              </span>
            )
          )}

          {/* ADDRESS */}
          {business.address && (
            <p className="text-xs text-services line-clamp-1">
              {business.address}
            </p>
          )}

          {/* DESCRIPTION */}
          {business.description && (
            <p className="mt-0.5 text-[11px] text-gray-600 line-clamp-2">
              {business.description}
            </p>
          )}
        </div>

        {/* BUTTONS — SIEMPRE ABAJO */}
        <div className="mt-auto flex gap-1.5 pt-2">
          {business.whatsapp && (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => track(business.id, "whatsapp")}
              className="flex-1 flex items-center justify-center gap-1 text-[11px] bg-primary text-white px-2 py-1 rounded-lg hover:scale-105 transition"
            >
              <img width={14} src={wspLogo} />
              Whatsapp
            </a>
          )}

          {business.instagram && (
            <a
              href={instagramUrl(business.instagram)!}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => track(business.id, "instagram")}
              className="p-1.5 rounded-lg bg-secondary-soft/10 hover:bg-secondary-soft/30 transition"
            >
              <InstagramIcon size={16} className="text-gray-700" />
            </a>
          )}

          {business.phone && (
            <a
              href={`tel:${business.phone}`}
              onClick={() => track(business.id, "phone")}
              className="p-1.5 rounded-lg bg-secondary-soft/10 hover:bg-secondary-soft/30 transition"
            >
              <PhoneCall size={16} className="text-gray-700" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
