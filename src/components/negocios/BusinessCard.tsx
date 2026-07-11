import { navigate } from "astro:transitions/client";
import { BadgeCheck, PhoneCall } from "lucide-react";
import InstagramIcon from "../icons/InstagramIcon";
import { getTodayStatus } from "../../lib/hours";
import { optimizedImage } from "../../lib/images";
import type { BusinessSummary } from "../../lib/repositories/business.repository";

type BusinessCardProps = {
  business: BusinessSummary;
};

const no_image = "/images/no-image.jpg";
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
        <div className="absolute top-2 left-2 z-10 flex flex-wrap gap-1">
          {business.categories.map((category) => (
            <span
              key={category.id}
              className="text-xs px-2 bg-primary text-white rounded-full border border-white/30"
            >
              {category.name}
            </span>
          ))}
        </div>

        <img
          src={
            business.coverPhoto?.url
              ? optimizedImage(business.coverPhoto.url, 480)
              : no_image
          }
          alt={business.name}
          width={400}
          height={192}
          loading="lazy"
          decoding="async"
          className="h-48 w-full object-cover cursor-pointer"
        />
      </div>

      {/* CONTENT */}
      <div className="flex flex-col p-3 flex-1">
        {/* TOP INFO */}
        <div>
          {/* NAME */}
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-gray-900">{business.name}</h3>

            {business.is_featured && (
              <BadgeCheck size={18} className="text-services" />
            )}
          </div>

          {/* STATUS */}
          {status && (
            <span
              className={`text-xs uppercase ${
                status.status === "open"
                  ? "text-green-600"
                  : status.status === "closed"
                    ? "text-red-500"
                    : "text-gray-500"
              }`}
            >
              ● {status.label}
            </span>
          )}

          {/* ADDRESS */}
          {business.address && (
            <p className="text-sm text-services">{business.address}</p>
          )}

          {/* DESCRIPTION */}
          <p className="mt-1 text-xs text-gray-600 line-clamp-3">
            {business.description}
          </p>
        </div>

        {/* BUTTONS — SIEMPRE ABAJO */}
        <div className="mt-auto flex gap-2 pt-3">
          {business.whatsapp && (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-1 text-xs bg-primary text-white px-4 py-1.5 rounded-lg hover:scale-105 transition"
            >
              <img width={18} src={wspLogo} />
              Whatsapp
            </a>
          )}

          {business.instagram && (
            <a
              href={business.instagram}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-lg bg-secondary-soft/10 hover:bg-secondary-soft/30 transition"
            >
              <InstagramIcon size={20} className="text-gray-700" />
            </a>
          )}

          {business.phone && (
            <a
              href={`tel:${business.phone}`}
              className="p-2 rounded-lg bg-secondary-soft/10 hover:bg-secondary-soft/30 transition"
            >
              <PhoneCall size={20} className="text-gray-700" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
