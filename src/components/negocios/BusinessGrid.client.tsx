import { useEffect, useState } from "react";
import BusinessCard from "./BusinessCard";
import { getBusinesses } from "../../lib/repositories/business.repository";

export default function BusinessGrid() {
  const [allBusinesses, setAllBusinesses] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getBusinesses().then((data) => {
      setAllBusinesses(data);
      setLoading(false);
    });
  }, []);

  const applyFilters = () => {
    const params = new URLSearchParams(window.location.search);
    const category = params.get("categoria");
    const search = params.get("buscar")?.toLowerCase();

    let result = [...allBusinesses];

    if (category) {
      result = result.filter((b) => b.categories?.slug === category);
    }

    if (search) {
      result = result.filter(
        (b) =>
          b.name.toLowerCase().includes(search) ||
          b.description?.toLowerCase().includes(search) ||
          b.categories?.name.toLowerCase().includes(search)
      );
    }

    setFiltered(result);
  };

  useEffect(() => {
    if (allBusinesses.length === 0) return;

    applyFilters();
    window.addEventListener("urlchange", applyFilters);
    return () => window.removeEventListener("urlchange", applyFilters);
  }, [allBusinesses]);

  if (loading) {
    return <p className="py-12 text-center text-gray-400">Cargando…</p>;
  }

  if (filtered.length === 0) {
    return (
      <div className="col-span-full py-12 text-center text-gray-500">
        No se encontraron comercios con esos filtros.
      </div>
    );
  }

  return (
    <div id="comercios" className="grid gap-6 sm:grid-cols-3 lg:grid-cols-4">
      {filtered.map((business) => (
        <BusinessCard key={business.id} business={business} />
      ))}
    </div>
  );
}
