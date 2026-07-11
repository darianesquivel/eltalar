import { useState } from "react";
import { supabaseBrowser } from "../../lib/supabase/browser";

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

  const pending = items.filter((b) => b.status === "pending");
  const rest = items.filter((b) => b.status !== "pending");

  const row = (b: AdminBusiness) => (
    <li
      key={b.id}
      className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-sm ${busy === b.id ? "opacity-50" : ""}`}
    >
      <div>
        <p className="font-semibold">
          {b.name}
          {b.is_featured && <span className="ml-2 text-amber-500">⭐</span>}
        </p>
        <p className="text-xs text-gray-500">
          {b.address ?? "sin dirección"} ·{" "}
          <span
            className={
              b.status === "approved"
                ? "text-green-600"
                : b.status === "rejected"
                  ? "text-red-500"
                  : "text-yellow-600"
            }
          >
            {b.status}
          </span>
          {!b.owner_id && " · sin dueño (carga admin)"}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {b.status !== "approved" && (
          <button
            onClick={() => setStatus(b.id, "approved")}
            disabled={busy === b.id}
            className="rounded-full bg-green-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-green-700"
          >
            Aprobar
          </button>
        )}
        {b.status !== "rejected" && (
          <button
            onClick={() => setStatus(b.id, "rejected")}
            disabled={busy === b.id}
            className="rounded-full bg-red-100 px-4 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-200"
          >
            Rechazar
          </button>
        )}
        {b.status === "approved" && (
          <button
            onClick={() => toggleFeatured(b.id, !b.is_featured)}
            disabled={busy === b.id}
            className={`rounded-full px-4 py-1.5 text-xs font-semibold ${
              b.is_featured
                ? "bg-amber-100 text-amber-700 hover:bg-amber-200"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {b.is_featured ? "Quitar destacado" : "Destacar ⭐"}
          </button>
        )}
        <a
          href={`/app/negocios/${b.id}`}
          className="rounded-full border border-gray-200 px-4 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
        >
          Editar
        </a>
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
