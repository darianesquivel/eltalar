import { useEffect, useState } from "react";
import BusinessCard from "./BusinessCard";
import type { Business } from "../../lib/repositories/business.repository";

type BusinessGridProps = {
  businesses: Business[];
};

// Los negocios llegan por props desde el servidor (SEO). Este componente solo
// aplica los filtros de la URL (?categoria= / ?buscar=) del lado del cliente.
export default function BusinessGrid({ businesses }: BusinessGridProps) {
  const [filtered, setFiltered] = useState<Business[]>(businesses);

  const applyFilters = () => {
    const params = new URLSearchParams(window.location.search);
    const category = params.get("categoria");
    const search = params.get("buscar")?.toLowerCase();

    let result = [...businesses];

    if (category) {
      result = result.filter((b) =>
        b.categories?.some((c) => c.slug === category),
      );
    }

    if (search) {
      result = result.filter(
        (b) =>
          b.name.toLowerCase().includes(search) ||
          b.description?.toLowerCase().includes(search) ||
          b.categories?.some((c) => c.name.toLowerCase().includes(search)),
      );
    }

    setFiltered(result);
  };

  useEffect(() => {
    applyFilters();
    window.addEventListener("urlchange", applyFilters);
    window.addEventListener("popstate", applyFilters);
    return () => {
      window.removeEventListener("urlchange", applyFilters);
      window.removeEventListener("popstate", applyFilters);
    };
  }, []);

  if (filtered.length === 0) {
    return (
      <div className="col-span-full py-12 text-center text-gray-500">
        No se encontraron comercios con esos filtros.
      </div>
    );
  }

  return (
    <div className="flex flex-col justify-center items-center gap-5">
      <p className="font-bold bg-primary text-white py-1 px-10 rounded-full">
        Total: {filtered.length}
      </p>
      <div id="comercios" className="grid gap-6 sm:grid-cols-3 lg:grid-cols-4">
        {filtered.map((business) => (
          <BusinessCard key={business.id} business={business} />
        ))}
      </div>
    </div>
  );
}
