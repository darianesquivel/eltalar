import { useEffect, useRef, useState } from "react";
import {
  Check,
  Ban,
  Star,
  Pencil,
  Eye,
  Trash2,
  X,
  Search,
  UserX,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { supabaseBrowser } from "../../lib/supabase/browser";
import IconButton from "./IconButton";

type AdminBusiness = {
  id: string;
  name: string;
  slug: string;
  address: string | null;
  status: string;
  is_active: boolean | null;
  is_featured: boolean | null;
  owner_id: string | null;
};

type CategoryOption = { id: string; name: string };

const SELECT = "id, name, slug, address, status, is_active, is_featured, owner_id";
const PAGE_SIZE = 30;

// La lista se filtra y pagina EN LA BASE (Supabase corta cualquier select en
// 1000 filas: con 1700 negocios, "traer todo" mostraba una lista incompleta).
export default function AdminBusinesses() {
  // Filtros (aplican a la tabla "Todos")
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [categories, setCategories] = useState<CategoryOption[]>([]);

  // Tabla izquierda: todos los negocios, paginados
  const [items, setItems] = useState<AdminBusiness[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);

  // Tabla derecha: pendientes de aprobación
  const [pending, setPending] = useState<AdminBusiness[]>([]);
  const [pendingTotal, setPendingTotal] = useState(0);

  // Acciones
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [confirmRemoveOwner, setConfirmRemoveOwner] = useState<string | null>(
    null,
  );

  // Descarta respuestas viejas si cambió el filtro mientras cargaba
  const seq = useRef(0);

  const loadAll = async (pageArg: number, q: string, catId: string) => {
    const mySeq = ++seq.current;
    setLoading(true);

    let request = supabaseBrowser
      .from("businesses")
      .select(
        catId ? `${SELECT}, business_categories!inner(category_id)` : SELECT,
        { count: "exact" },
      );

    if (catId) request = request.eq("business_categories.category_id", catId);

    const clean = q.replace(/[,()%\\]/g, " ").trim();
    if (clean) {
      request = request.or(`name.ilike.%${clean}%,address.ilike.%${clean}%`);
    }

    const { data, count, error } = await request
      .order("created_at", { ascending: false })
      .order("id", { ascending: true })
      .range(pageArg * PAGE_SIZE, pageArg * PAGE_SIZE + PAGE_SIZE - 1);

    if (mySeq !== seq.current) return;
    if (error) {
      console.error(error);
    } else {
      // El parser de tipos de supabase-js no banca el select armado dinámico
      setItems((data as unknown as AdminBusiness[]) ?? []);
      setTotal(count ?? 0);
    }
    setLoading(false);
  };

  const loadPending = async () => {
    const { data, count, error } = await supabaseBrowser
      .from("businesses")
      .select(SELECT, { count: "exact" })
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(100);

    if (!error) {
      setPending((data as AdminBusiness[]) ?? []);
      setPendingTotal(count ?? 0);
    }
  };

  // Carga inicial: categorías para el filtro + ambas tablas
  useEffect(() => {
    supabaseBrowser
      .from("categories")
      .select("id, name")
      .order("name")
      .then(({ data }) => setCategories((data as CategoryOption[]) ?? []));
    loadPending();
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 400);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    setPage(0);
    loadAll(0, debounced, categoryId);
  }, [debounced, categoryId]);

  const goToPage = (p: number) => {
    setPage(p);
    loadAll(p, debounced, categoryId);
  };

  // Refleja un cambio de estado en ambas tablas sin re-consultar todo
  const patchLocal = (id: string, patch: Partial<AdminBusiness>) => {
    setItems((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
    setPending((prev) =>
      prev
        .map((b) => (b.id === id ? { ...b, ...patch } : b))
        .filter((b) => b.status === "pending"),
    );
  };

  const setStatus = async (id: string, status: string) => {
    setBusy(id);
    const { error } = await supabaseBrowser.rpc("admin_set_business_status", {
      p_business_id: id,
      p_status: status,
    });
    if (!error) {
      patchLocal(id, { status, is_active: status === "approved" });
      setPendingTotal((n) => Math.max(0, status === "pending" ? n : n - 1));
    } else {
      console.error(error);
      alert("Error actualizando el estado");
    }
    setBusy(null);
  };

  const toggleFeatured = async (id: string, featured: boolean) => {
    setBusy(id);
    const { error } = await supabaseBrowser.rpc("admin_set_featured", {
      p_business_id: id,
      p_featured: featured,
    });
    if (!error) {
      patchLocal(id, { is_featured: featured });
    } else {
      console.error(error);
      alert("Error actualizando destacado");
    }
    setBusy(null);
  };

  // Quita el dueño y limpia los reclamos: el negocio vuelve a ser reclamable
  const removeOwner = async (id: string) => {
    setBusy(id);
    const { error } = await supabaseBrowser.rpc("admin_remove_owner", {
      p_business_id: id,
    });
    if (!error) {
      patchLocal(id, { owner_id: null });
    } else {
      console.error(error);
      alert("Error quitando el dueño");
    }
    setBusy(null);
    setConfirmRemoveOwner(null);
  };

  const remove = async (id: string) => {
    setBusy(id);
    try {
      // Limpia las fotos del storage antes de borrar la fila
      const { data: photos } = await supabaseBrowser
        .from("business_photos")
        .select("url")
        .eq("business_id", id);

      const marker = "/business-photos/";
      const paths = (photos ?? [])
        .map((p) => {
          const idx = p.url.indexOf(marker);
          return idx === -1
            ? null
            : decodeURIComponent(p.url.slice(idx + marker.length));
        })
        .filter((p): p is string => Boolean(p));

      if (paths.length > 0) {
        await supabaseBrowser.storage.from("business-photos").remove(paths);
      }

      const { error } = await supabaseBrowser
        .from("businesses")
        .delete()
        .eq("id", id);
      if (error) throw error;

      setItems((prev) => prev.filter((b) => b.id !== id));
      setPending((prev) => prev.filter((b) => b.id !== id));
      setTotal((n) => Math.max(0, n - 1));
    } catch (err) {
      console.error(err);
      alert("Error borrando el negocio");
    } finally {
      setBusy(null);
      setConfirmDelete(null);
    }
  };

  const actions = (b: AdminBusiness) =>
    confirmRemoveOwner === b.id ? (
      <>
        <span className="text-[11px] font-semibold text-amber-700">
          ¿Quitar dueño?
        </span>
        <IconButton
          small
          label="Sí, quitar dueño"
          variant="warning"
          disabled={busy === b.id}
          onClick={() => removeOwner(b.id)}
        >
          <Check size={13} />
        </IconButton>
        <IconButton
          small
          label="Cancelar"
          onClick={() => setConfirmRemoveOwner(null)}
        >
          <X size={13} />
        </IconButton>
      </>
    ) : confirmDelete === b.id ? (
      <>
        <span className="text-[11px] font-semibold text-red-600">¿Borrar?</span>
        <IconButton
          small
          label="Sí, borrar definitivamente"
          variant="danger"
          disabled={busy === b.id}
          onClick={() => remove(b.id)}
        >
          <Check size={13} />
        </IconButton>
        <IconButton small label="Cancelar" onClick={() => setConfirmDelete(null)}>
          <X size={13} />
        </IconButton>
      </>
    ) : (
      <>
        {b.status !== "approved" && (
          <IconButton
            small
            label="Aprobar y publicar"
            variant="success"
            disabled={busy === b.id}
            onClick={() => setStatus(b.id, "approved")}
          >
            <Check size={13} />
          </IconButton>
        )}
        {b.status !== "rejected" && (
          <IconButton
            small
            label="Rechazar"
            variant="danger"
            disabled={busy === b.id}
            onClick={() => setStatus(b.id, "rejected")}
          >
            <Ban size={13} />
          </IconButton>
        )}
        {b.status === "approved" && (
          <IconButton
            small
            label={b.is_featured ? "Quitar destacado" : "Destacar"}
            variant="warning"
            active={b.is_featured === true}
            disabled={busy === b.id}
            onClick={() => toggleFeatured(b.id, !b.is_featured)}
          >
            <Star size={13} fill={b.is_featured ? "currentColor" : "none"} />
          </IconButton>
        )}
        {b.is_active && (
          <IconButton small label="Ver ficha pública" href={`/negocios/${b.slug}`}>
            <Eye size={13} />
          </IconButton>
        )}
        <IconButton small label="Editar" href={`/app/negocios/${b.id}`}>
          <Pencil size={13} />
        </IconButton>
        {b.owner_id && (
          <IconButton
            small
            label="Quitar dueño (queda reclamable)"
            variant="warning"
            disabled={busy === b.id}
            onClick={() => setConfirmRemoveOwner(b.id)}
          >
            <UserX size={13} />
          </IconButton>
        )}
        <IconButton
          small
          label="Borrar"
          variant="danger"
          disabled={busy === b.id}
          onClick={() => setConfirmDelete(b.id)}
        >
          <Trash2 size={13} />
        </IconButton>
      </>
    );

  const statusLabel = (s: string) =>
    s === "approved" ? (
      <span className="text-green-600">publicado</span>
    ) : s === "rejected" ? (
      <span className="text-red-500">rechazado</span>
    ) : (
      <span className="text-yellow-600">pendiente</span>
    );

  const row = (b: AdminBusiness) => (
    <tr
      key={b.id}
      className={`border-b border-gray-100 last:border-0 ${busy === b.id ? "opacity-50" : ""}`}
    >
      <td className="max-w-0 py-1 pl-3 pr-2">
        <p className="truncate text-xs font-semibold" title={b.name}>
          {b.is_featured && <span className="text-amber-500">⭐ </span>}
          {b.name}
        </p>
        <p
          className="truncate text-[10px] text-gray-400"
          title={b.address ?? ""}
        >
          {statusLabel(b.status)}
          {!b.owner_id && " · sin dueño"}
          {b.address && ` · ${b.address}`}
        </p>
      </td>
      <td className="w-px whitespace-nowrap py-1 pr-3">
        <div className="flex items-center justify-end gap-1">{actions(b)}</div>
      </td>
    </tr>
  );

  const lastPage = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1);
  const from = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const to = Math.min(total, (page + 1) * PAGE_SIZE);

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      {/* Filtros: buscan EN LA BASE (nombre o dirección) + categoría */}
      <div className="flex shrink-0 flex-wrap gap-2">
        <div className="relative min-w-52 flex-1">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre o dirección…"
            className="field pl-9"
          />
        </div>
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="field select-field w-56"
        >
          <option value="">Todas las categorías</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* Dos tablas lado a lado: todos | pendientes */}
      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-2">
        {/* TODOS */}
        <div className="flex min-h-0 flex-col gap-2">
          <h2 className="shrink-0 text-sm font-semibold text-gray-500">
            Todos los negocios{" "}
            <span className="ml-1 rounded-full bg-gray-200 px-2.5 py-0.5 text-xs text-gray-600">
              {total}
            </span>
          </h2>

          <div className="min-h-0 flex-1 overflow-y-auto rounded-xl bg-white shadow-sm">
            <table className="w-full table-fixed">
              <tbody>
                {items.map(row)}
                {!loading && items.length === 0 && (
                  <tr>
                    <td colSpan={2} className="px-4 py-6 text-sm text-gray-500">
                      Ningún negocio coincide con esos filtros.
                    </td>
                  </tr>
                )}
                {loading && (
                  <tr>
                    <td colSpan={2} className="px-4 py-6 text-sm text-gray-400">
                      Cargando…
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Paginado */}
          <div className="flex shrink-0 items-center justify-between text-xs text-gray-500">
            <span>
              {from}–{to} de {total}
            </span>
            <div className="flex items-center gap-1">
              <IconButton
                small
                label="Página anterior"
                disabled={page === 0 || loading}
                onClick={() => goToPage(page - 1)}
              >
                <ChevronLeft size={13} />
              </IconButton>
              <span className="px-1 tabular-nums">
                {page + 1}/{lastPage + 1}
              </span>
              <IconButton
                small
                label="Página siguiente"
                disabled={page >= lastPage || loading}
                onClick={() => goToPage(page + 1)}
              >
                <ChevronRight size={13} />
              </IconButton>
            </div>
          </div>
        </div>

        {/* PENDIENTES */}
        <div className="flex min-h-0 flex-col gap-2">
          <h2 className="shrink-0 text-sm font-semibold text-gray-500">
            Pendientes de aprobación{" "}
            {pendingTotal > 0 && (
              <span className="ml-1 rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs text-yellow-700">
                {pendingTotal}
              </span>
            )}
          </h2>

          {pending.length > 0 ? (
            <div className="min-h-0 flex-1 overflow-y-auto rounded-xl bg-white shadow-sm">
              <table className="w-full table-fixed">
                <tbody>{pending.map(row)}</tbody>
              </table>
            </div>
          ) : (
            <p className="rounded-xl bg-gray-50 px-5 py-3 text-sm text-gray-500">
              No hay negocios esperando revisión. 👌
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
