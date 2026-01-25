import { getTodayBusinessStatus } from "../../lib/getTodayBusinessStatus";

type BusinessCardProps = {
  business: any;
};

const no_image = "/images/no-image.jpg"
const wspLogo = "/images/whatsapp-icon.svg"

export default function BusinessCard({ business }: BusinessCardProps) {

  const status = getTodayBusinessStatus(business);

  const whatsappUrl = `https://wa.me/${business.whatsapp
    }?text=${encodeURIComponent(business.whatsapp_message ?? "")}`;

  const handleClick = () => {
    window.location.href = `/negocios/${business.slug}`;
  }

  type Category = {
    id: string;
    name: string;
    slug: string;
    icon?: string | null;
  };

  return (
    <div>
      <div
        className="overflow-hidden rounded-2xl shadow-sm relative cursor-pointer transition-transform duration-300 hover:scale-105"
        onClick={handleClick}
      >
        <div className="absolute top-1 left-1 z-10 flex flex-wrap gap-1">
          {business.categories.map((category: Category) => (
            <span
              key={category.id}
              className="text-xs px-2 bg-primary border border-white/30 text-white rounded-full"
            >
              {category.name}
            </span>
          ))}
        </div>

        <img
          src={business?.coverPhoto?.url || no_image}
          alt={business.name}
          className="h-50 w-full object-cover"
          style={{
            viewTransitionName: `img-${business.slug}`,
          }}
        />
      </div>


      <div className="p-2 flex flex-col gap-1">

        {/* NAME & FEATURED */}
        <div className="flex gap-2 items-center">
          <h3 className="font-semibold text-gray-900">{business.name}</h3>
          {
            business.is_featured &&
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" className="lucide lucide-badge-check-icon lucide-badge-check text-services"><path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z" /><path d="m9 12 2 2 4-4" /></svg>

          }
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


        {/* DESCRIPTION */}
        <h4 className="font-light text-xs text-gray-600 line-clamp-3">{business.description}</h4>

        {/* ADDRESS */}
        <p className="text-sm text-services">{business.address}</p>



        {/* BUTTONS */}
        <div className="flex gap-2 items-center">
          {
            business.whatsapp &&
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 text-xs flex items-center gap-1 justify-center transition-transform duration-200 hover:scale-105 bg-primary text-white px-5 py-1 rounded-lg"
            >
              <img width={20} src={wspLogo} /> Whatsapp
            </a>
          }

          {
            business.instagram &&
            <a
              href={business.instagram}
              target="_blank"
              rel="noopener noreferrer"
              className="w-fit inline-flex items-center justify-center transition-transform duration-300 hover:scale-110 bg-secondary-soft/10 hover:bg-secondary-soft/30 p-1 rounded-lg"
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
          }

          {
            business.phone &&
            <a
              href={`tel:${business.phone}`}
              className="w-fit inline-flex items-center justify-center transition-transform duration-200 hover:scale-110 bg-secondary-soft/10 hover:bg-secondary-soft/30 p-1 rounded-lg"
              aria-label="Llamar por teléfono"
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

          }
        </div>

      </div>
    </div>

  );
}
