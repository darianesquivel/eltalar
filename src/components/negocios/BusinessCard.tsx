
type BusinessCardProps = {
  business: any;
};
const no_image = "/images/no-image.jpg"
const wspLogo = "/images/whatsapp-icon.svg"
const instagramLogo = "/images/instagram-icon.svg"



export default function BusinessCard({ business }: BusinessCardProps) {
  const whatsappUrl = `https://wa.me/${business.whatsapp
    }?text=${encodeURIComponent(business.whatsapp_message ?? "")}`;

  const handleClick = () => {
    window.location.href = `/negocios/${business.slug}`;
  }
  const today = new Date().getDay();

  const todayHours = business.business_hours?.filter(
    (h: any) => h.day_of_week === today
  );

  const shouldShowStatus = todayHours && todayHours.length > 0;

  const isClosedToday =
    shouldShowStatus && todayHours.every((h: any) => h.is_closed);

  return (
    <div>
      <div className="overflow-hidden rounded-2xl shadow-sm relative cursor-pointer transition-transform duration-300 hover:scale-105" onClick={handleClick}>
        <p className="absolute text-xs px-2 py-0.5 bg-white w-fit rounded-full top-1 left-1">{business.categories.name}</p>
        <img
          src={business?.coverPhoto?.url || no_image}
          alt={business.name}
          className="h-40 w-full object-cover"
          style={{
            viewTransitionName: `img-${business.slug}`,
          }}
        />

      </div>

      <div className="p-2 flex flex-col gap-2">
        <h3 className="font-semibold text-gray-900">{business.name}</h3>
        <h4 className="font-light text-xs text-gray-600">{business.description}</h4>
        <p className="text-sm text-primary/50">{business.address}</p>

        {
          shouldShowStatus && (
            <span
              className={`text-sm font-medium ${isClosedToday || !business.is_open
                ? "text-red-500"
                : "text-green-600"
                }`}
            >
              ● {isClosedToday || !business.is_open ? "Cerrado" : "Abierto"}
            </span>
          )
        }

        <div className="flex gap-2">
          {
            business.whatsapp && <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-fit inline-flex items-center justify-center transition-transform duration-200 hover:scale-110"
            >
              <img width={35} src={wspLogo} />
            </a>
          }

          {
            business.instagram &&
            <a
              href={business.instagram}
              target="_blank"
              rel="noopener noreferrer"
              className="w-fit inline-flex items-center justify-center transition-transform duration-200 hover:scale-110"
            >
              <img width={35} src={instagramLogo} />
            </a>
          }

          {
            business.phone &&
            <a
              href={`tel:${business.phone}`}
              className="w-fit h-fit items-center justify-center transition-transform duration-200 hover:scale-110 text-xs flex gap-2 bg-blue-200 px-2 py-1 rounded-full shadow-2xl shadow-black"
              aria-label="Llamar por teléfono"
            >
              <img width={20} src="/images/phone-icon.svg" alt="Llamar" />
              Llamar ahora
            </a>

          }
        </div>

      </div>
    </div>

  );
}
