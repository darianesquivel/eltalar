import { useEffect, useState } from "react";
import type { Category } from "../../lib/repositories/business.repository";

type CategoryFilterProps = {
  categories: Category[];
};

// Las categorías llegan por props desde el servidor. Este componente solo
// sincroniza el buscador y el select con la URL (?categoria= / ?buscar=).
export default function CategoryFilter({ categories }: CategoryFilterProps) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const syncFromUrl = () => {
    const params = new URLSearchParams(window.location.search);
    setActiveCategory(params.get("categoria"));
    setSearchQuery(params.get("buscar") ?? "");
  };

  useEffect(() => {
    syncFromUrl();
    window.addEventListener("popstate", syncFromUrl);
    return () => window.removeEventListener("popstate", syncFromUrl);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 500);
    return () => clearTimeout(t);
  }, [searchQuery]);

  useEffect(() => {
    const url = new URL(window.location.href);

    if (debouncedSearch) {
      url.searchParams.set("buscar", debouncedSearch);
      url.searchParams.delete("categoria");
      setActiveCategory(null);
    } else {
      url.searchParams.delete("buscar");
    }

    window.history.pushState({}, "", url);
    window.dispatchEvent(new Event("urlchange"));
  }, [debouncedSearch]);

  const setCategory = (slug: string | null) => {
    const url = new URL(window.location.href);

    if (slug) {
      url.searchParams.set("categoria", slug);
      url.searchParams.delete("buscar");
      setSearchQuery("");
      setActiveCategory(slug);
    } else {
      url.searchParams.delete("categoria");
      setActiveCategory(null);
    }

    window.history.pushState({}, "", url);
    window.dispatchEvent(new Event("urlchange"));
  };

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col sm:flex-row gap-3">
      {/* Buscador */}
      <input
        type="text"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="Buscar comercio..."
        className="field flex-1"
      />

      {/* Select de categorías */}
      <select
        value={activeCategory ?? ""}
        onChange={(e) => setCategory(e.target.value || null)}
        className="field select-field sm:w-64"
      >
        <option value="">Todas las categorías</option>

        {categories.map((cat) => (
          <option key={cat.id} value={cat.slug}>
            {cat.name}
          </option>
        ))}
      </select>
    </div>
  );
}
