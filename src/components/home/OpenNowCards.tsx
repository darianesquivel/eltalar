import BusinessCard from "../negocios/BusinessCard";
import type { BusinessSummary } from "../../lib/repositories/business.repository";

/**
 * Las cards de "Abiertos ahora" en UNA sola isla: antes cada card era su
 * propio root de React (4 hidrataciones y 4 copias del runtime de props en
 * el HTML de la home).
 */
export default function OpenNowCards({
  businesses,
}: {
  businesses: BusinessSummary[];
}) {
  return (
    <>
      {businesses.map((business) => (
        <BusinessCard key={business.id} business={business} />
      ))}
    </>
  );
}
