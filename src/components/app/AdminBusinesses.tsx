import { useState } from "react";
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

type Props = {
  businesses: AdminBusiness[];
};

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

export default function AdminBusinesses({ businesses }: Props) {
  const [items, setItems] = useState(businesses);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [confirmRemoveOwner, setConfirmRemoveOwner] = useState<string | null>(
    null,
  );
  const [query, setQuery] = useState("");

  // Quita el dueño y limpia los reclamos: el negocio vuelve a ser reclamable
  // (incluso por el mismo usuario). Es la vuelta atrás de una adjudicación.
  const removeOwner = async (id: string) => {
    setBusy(id);
    const { error } = await supabaseBrowser.rpc("admin_remove_owner", {
      p_business_id: id,
    });
    if (!error) {
      setItems((prev) =>
        prev.map((b) => (b.id === id ? { ...b, owner_id: null } : b)),
      );
    } else {
      console.error(error);
      alert("Error quitando el dueño");
    }
    setBusy(null);
    setConfirmRemoveOwner(null);
  };

  const setStatus = async (id: string, status: string) => {
    setBusy(id);
    const { error } = await supabaseBrowser.rpc("admin_set_business_status", {
      p_business_id: id,
      p_status: status,
    });
    if (!error) {
      setItems((prev) =>
        prev.map((b) =>
          b.id === id ? { ...b, status, is_active: status === "approved" } : b,
        ),
      );
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
      setItems((prev) =>
        prev.map((b) => (b.id === id ? { ...b, is_featured: featured } : b)),
      );
    } else {
      console.error(error);
      alert("Error actualizando destacado");
    }
    setBusy(null);
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
    } catch (err) {
      console.error(err);
      alert("Error borrando el negocio");
    } finally {
      setBusy(null);
      setConfirmDelete(null);
    }
  };

  // Filtro por nombre/dirección (clave cuando la lista crece)
  const q = normalize(query.trim());
  const visible = q
    ? items.filter(
        (b) =>
          normalize(b.name).includes(q) ||
          (b.address && normalize(b.address).includes(q)),
      )
    : items;

  const pending = visible.filter((b) => b.status === "pending");
  const rest = visible.filter((b) => b.status !== "pending");

  const row = (b: AdminBusiness) => (
    <li
      key={b.id}
      className={`flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm ${busy === b.id ? "opacity-50" : ""}`}
    >
      {/* Info: min-w-0 + truncate = los títulos largos no deforman la fila */}
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold" title={b.name}>
          {b.name}
          {b.is_featured && <span className="ml-1.5 text-amber-500">⭐</span>}
        </p>
        <p className="truncate text-xs text-gray-500" title={b.address ?? ""}>
          <span
            className={
              b.status === "approved"
                ? "text-green-600"
                : b.status === "rejected"
                  ? "text-red-500"
                  : "text-yellow-600"
            }
          >
            {b.status === "approved"
              ? "publicado"
              : b.status === "rejected"
                ? "rechazado"
                : "pendiente"}
          </span>
          {!b.owner_id && " · sin dueño"}
          {b.address && ` · ${b.address}`}
        </p>
      </div>

      {/* Acciones: solo íconos con tooltip, nunca se achican */}
      <div className="flex shrink-0 items-center gap-1.5">
        {confirmRemoveOwner === b.id ? (
          <>
            <span className="text-xs font-semibold text-amber-700">
              ¿Quitar dueño? Queda reclamable
            </span>
            <IconButton
              label="Sí, quitar dueño"
              variant="warning"
              disabled={busy === b.id}
              onClick={() => removeOwner(b.id)}
            >
              <Check size={16} />
            </IconButton>
            <IconButton
              label="Cancelar"
              onClick={() => setConfirmRemoveOwner(null)}
            >
              <X size={16} />
            </IconButton>
          </>
        ) : confirmDelete === b.id ? (
          <>
            <span className="text-xs font-semibold text-red-600">¿Borrar?</span>
            <IconButton
              label="Sí, borrar definitivamente"
              variant="danger"
              disabled={busy === b.id}
              onClick={() => remove(b.id)}
            >
              <Check size={16} />
            </IconButton>
            <IconButton label="Cancelar" onClick={() => setConfirmDelete(null)}>
              <X size={16} />
            </IconButton>
          </>
        ) : (
          <>
            {b.status !== "approved" && (
              <IconButton
                label="Aprobar y publicar"
                variant="success"
                disabled={busy === b.id}
                onClick={() => setStatus(b.id, "approved")}
              >
                <Check size={16} />
              </IconButton>
            )}
            {b.status !== "rejected" && (
              <IconButton
                label="Rechazar"
                variant="danger"
                disabled={busy === b.id}
                onClick={() => setStatus(b.id, "rejected")}
              >
                <Ban size={16} />
              </IconButton>
            )}
            {b.status === "approved" && (
              <IconButton
                label={b.is_featured ? "Quitar destacado" : "Destacar"}
                variant="warning"
                active={b.is_featured === true}
                disabled={busy === b.id}
                onClick={() => toggleFeatured(b.id, !b.is_featured)}
              >
                <Star
                  size={16}
                  fill={b.is_featured ? "currentColor" : "none"}
                />
              </IconButton>
            )}
            {b.is_active && (
              <IconButton
                label="Ver ficha pública"
                href={`/negocios/${b.slug}`}
              >
                <Eye size={16} />
              </IconButton>
            )}
            <IconButton label="Editar" href={`/app/negocios/${b.id}`}>
              <Pencil size={16} />
            </IconButton>
            {b.owner_id && (
              <IconButton
                label="Quitar dueño (queda reclamable)"
                variant="warning"
                disabled={busy === b.id}
                onClick={() => setConfirmRemoveOwner(b.id)}
              >
                <UserX size={16} />
              </IconButton>
            )}
            <IconButton
              label="Borrar"
              variant="danger"
              disabled={busy === b.id}
              onClick={() => setConfirmDelete(b.id)}
            >
              <Trash2 size={16} />
            </IconButton>
          </>
        )}
      </div>
    </li>
  );

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      {/* Buscador (fijo arriba) */}
      <div className="relative shrink-0">
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

      {/* Pendientes: bloque compacto con scroll propio si crece */}
      <div className="shrink-0 space-y-2">
        <h2 className="text-sm font-semibold text-gray-500">
          Pendientes de aprobación{" "}
          {pending.length > 0 && (
            <span className="ml-1 rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs text-yellow-700">
              {pending.length}
            </span>
          )}
        </h2>
        {pending.length > 0 ? (
          <ul className="max-h-[30vh] space-y-2 overflow-y-auto pr-1">
            {pending.map(row)}
          </ul>
        ) : (
          <p className="rounded-2xl bg-gray-50 px-5 py-3 text-sm text-gray-500">
            {q
              ? "Sin pendientes que coincidan."
              : "No hay negocios esperando revisión. 👌"}
          </p>
        )}
      </div>

      {/* Todos: ocupa el resto de la pantalla y scrollea adentro */}
      <div className="flex min-h-0 flex-1 flex-col gap-2">
        <h2 className="shrink-0 text-sm font-semibold text-gray-500">
          Todos los negocios{" "}
          <span className="ml-1 rounded-full bg-gray-200 px-2.5 py-0.5 text-xs text-gray-600">
            {rest.length}
          </span>
        </h2>
        <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
          {rest.map(row)}
          {rest.length === 0 && (
            <p className="rounded-2xl bg-gray-50 px-5 py-3 text-sm text-gray-500">
              Ningún negocio coincide con «{query}».
            </p>
          )}
        </ul>
      </div>
    </div>
  );
}
