import { getTodayStatus } from "../../lib/hours";

type BusinessCardProps = {
  business: any;
};

const no_image = "/images/no-image.jpg"
const wspLogo = "/images/whatsapp-icon.svg"

export default function BusinessCard({ business }: BusinessCardProps) {
  const status = getTodayStatus(business.business_hours);

  const whatsappUrl = `https://wa.me/${business.whatsapp}?text=${encodeURIComponent(
    business.whatsapp_message ?? ""
  )}`;

  const handleClick = () => {
    window.location.href = `/negocios/${business.slug}`;
  };

  type Category = {
    id: string;
    name: string;
    slug: string;
    icon?: string | null;
  };

  return (
    <div className="flex flex-col rounded-xl shadow-lg overflow-hidden">
      {/* IMAGE */}
      <div
        className="relative "
        onClick={handleClick}
      >
        <div className="absolute top-2 left-2 z-10 flex flex-wrap gap-1">
          {business.categories.map((category: Category) => (
            <span
              key={category.id}
              className="text-xs px-2 bg-primary text-white rounded-full border border-white/30"
            >
              {category.name}
            </span>
          ))}
        </div>

        <img
          src={business?.coverPhoto?.url || no_image}
          alt={business.name}
          className="h-48 w-full object-cover cursor-pointer transition-transform duration-300 hover:scale-105"
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
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-services"
              >
                <path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z" />
                <path d="m9 12 2 2 4-4" />
              </svg>
            )}
          </div>

          {/* STATUS */}
          {status && (
            <span
              className={`text-xs uppercase ${status.status === "open"
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
              <svg xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                className="text-gray-700">
                <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
              </svg>
            </a>
          )}

          {business.phone && (
            <a
              href={`tel:${business.phone}`}
              className="p-2 rounded-lg bg-secondary-soft/10 hover:bg-secondary-soft/30 transition"
            >
              <svg xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                className="text-gray-700">
                <path d="M13 2a9 9 0 0 1 9 9" />
                <path d="M13 6a5 5 0 0 1 5 5" />
                <path d="M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384" />
              </svg>
            </a>
          )}
        </div>
      </div>

    </div>
  );
}
