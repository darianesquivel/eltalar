import { useState } from "react";
import { supabaseBrowser } from "../../lib/supabase/browser";

type Claim = {
  id: string;
  business_id: string;
  claimer_email: string | null;
  message: string | null;
  status: string;
  created_at: string;
  businesses: { name: string } | null;
};

type Props = {
  claims: Claim[];
};

export default function ClaimsManager({ claims }: Props) {
  const [items, setItems] = useState(claims);
  const [busy, setBusy] = useState<string | null>(null);

  const resolve = async (id: string, approve: boolean) => {
    setBusy(id);
    const { error } = await supabaseBrowser.rpc("admin_resolve_claim", {
      p_claim_id: id,
      p_approve: approve,
    });
    if (error) {
      console.error(error);
      alert(error.message ?? "Error resolviendo el reclamo");
    } else {
      setItems((prev) =>
        prev.map((c) =>
          c.id === id ? { ...c, status: approve ? "approved" : "rejected" } : c,
        ),
      );
    }
    setBusy(null);
  };

  const pending = items.filter((c) => c.status === "pending");

  if (pending.length === 0) {
    return (
      <p className="rounded-2xl bg-gray-50 p-5 text-sm text-gray-500">
        No hay reclamos pendientes.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {pending.map((c) => (
        <li
          key={c.id}
          className={`rounded-2xl bg-white p-4 shadow-sm space-y-2 ${busy === c.id ? "opacity-50" : ""}`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-semibold">
                {c.businesses?.name ?? "(negocio borrado)"}
              </p>
              <p className="text-xs text-gray-500">
                Reclamado por <strong>{c.claimer_email ?? "?"}</strong> ·{" "}
                {new Date(c.created_at).toLocaleDateString("es-AR")}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => resolve(c.id, true)}
                disabled={busy === c.id}
                className="rounded-full bg-green-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-green-700"
              >
                Aprobar y transferir
              </button>
              <button
                onClick={() => resolve(c.id, false)}
                disabled={busy === c.id}
                className="rounded-full bg-red-100 px-4 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-200"
              >
                Rechazar
              </button>
            </div>
          </div>
          {c.message && (
            <p className="rounded-xl bg-gray-50 p-3 text-sm text-gray-600">
              “{c.message}”
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
