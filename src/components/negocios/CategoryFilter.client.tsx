import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

type Category = {
  id: string;
  name: string;
  slug: string;
};

export default function CategoryFilter() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const syncFromUrl = () => {
    const params = new URLSearchParams(window.location.search);
    setActiveCategory(params.get("categoria"));
    setSearchQuery(params.get("buscar") ?? "");
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("categories")
        .select("id, name, slug")
        .order("name");

      if (data) setCategories(data);
      setLoading(false);
    };

    load();
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
    <div className="min-w-full flex flex-col justify-center items-center gap-4 sm:w-2xl">
      <input
        type="text"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="Buscar comercio..."
        className="w-full sm:w-2xl rounded-full border px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
      />

      <div className="flex flex-wrap gap-2 w-full sm:w-2xl justify-center">
        {loading ? (
          <>
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-9 w-24 rounded-full bg-gray-200 animate-pulse"
              />
            ))}
          </>
        ) : (
          <>
            <button
              onClick={() => setCategory(null)}
              className={`px-2 py-1 rounded-full transition ${
                !activeCategory
                  ? "bg-blue-500 text-white"
                  : "bg-white text-gray-700 hover:bg-gray-100"
              }`}
            >
              Todos
            </button>

            {categories.map((cat) => {
              const isActive = activeCategory === cat.slug;

              return (
                <button
                  key={cat.id}
                  onClick={() => setCategory(cat.slug)}
                  className={`px-2 py-1 rounded-full transition-transform duration-300 hover:scale-105 ${
                    isActive
                      ? "bg-blue-500 text-white"
                      : "bg-white text-gray-700 hover:bg-blue-500 hover:text-white"
                  }`}
                >
                  {cat.name}
                </button>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
