import { useState } from "react";
import { Check, Ban, Star, Pencil, Eye, Trash2, X } from "lucide-react";
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

export default function AdminBusinesses({ businesses }: Props) {
  const [items, setItems] = useState(businesses);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

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

  const pending = items.filter((b) => b.status === "pending");
  const rest = items.filter((b) => b.status !== "pending");

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
        {confirmDelete === b.id ? (
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
    <div className="space-y-8">
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">
          Pendientes de aprobación{" "}
          {pending.length > 0 && (
            <span className="ml-1 rounded-full bg-yellow-100 px-3 py-0.5 text-sm text-yellow-700">
              {pending.length}
            </span>
          )}
        </h2>
        {pending.length > 0 ? (
          <ul className="space-y-2">{pending.map(row)}</ul>
        ) : (
          <p className="rounded-2xl bg-gray-50 p-5 text-sm text-gray-500">
            No hay negocios esperando revisión. 👌
          </p>
        )}
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Todos los negocios</h2>
        <ul className="space-y-2">{rest.map(row)}</ul>
      </div>
    </div>
  );
}
