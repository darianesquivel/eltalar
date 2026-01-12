import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import BusinessCard from "./BusinessCard";
import { getBusinessStatus } from "../../lib/businessHours";

export default function BusinessGrid() {
  const [allBusinesses, setAllBusinesses] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("businesses")
      .select(
        `
        *,
        categories ( id, name, slug ),
        business_hours ( day_of_week, open_time, close_time, is_closed )
      `
      )
      .eq("is_active", true)
      .order("priority", { ascending: false })
      .then(({ data, error }) => {
        if (error || !data) return;

        const withStatus = data.map((b) => {
          const status = getBusinessStatus(b.business_hours ?? []);
          return { ...b, ...status };
        });

        setAllBusinesses(withStatus);
        setLoading(false);
      });
  }, []);

  const applyFilters = () => {
    const params = new URLSearchParams(window.location.search);
    const categoria = params.get("categoria");
    const buscar = params.get("buscar")?.toLowerCase();

    let result = [...allBusinesses];

    if (categoria) {
      result = result.filter((b) => b.categories?.slug === categoria);
    }

    if (buscar) {
      result = result.filter((b) => {
        return (
          b.name.toLowerCase().includes(buscar) ||
          b.description?.toLowerCase().includes(buscar) ||
          b.categories?.name.toLowerCase().includes(buscar)
        );
      });
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
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {filtered.map((business) => (
        <BusinessCard key={business.id} business={business} />
      ))}
    </div>
  );
}
