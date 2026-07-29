import { useState } from "react";
import { ExternalLink, Pencil } from "lucide-react";
import { supabaseBrowser } from "../../lib/supabase/browser";

type Claim = {
  id: string;
  business_id: string;
  claimer_email: string | null;
  message: string | null;
  status: string;
  created_at: string;
  businesses: {
    name: string;
    slug: string;
    address: string | null;
    created_at: string | null;
    owner_id: string | null;
    is_active: boolean | null;
  } | null;
};

type Props = {
  claims: Claim[];
};

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });

export default function ClaimsManager({ claims }: Props) {
  const [items, setItems] = useState(claims);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const resolve = async (id: string, approve: boolean) => {
    setBusy(id);
    setActionError(null);
    const { error } = await supabaseBrowser.rpc("admin_resolve_claim", {
      p_claim_id: id,
      p_approve: approve,
    });
    if (error) {
      console.error(error);
      setActionError(error.message ?? "Error resolviendo el reclamo");
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
    <div className="space-y-2">
      {actionError && (
        <p role="alert" className="text-sm text-red-600">
          {actionError}
        </p>
      )}
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
              {c.businesses && (
                <p className="text-xs text-gray-500">
                  {c.businesses.address && `${c.businesses.address} · `}
                  {c.businesses.created_at &&
                    `cargado el ${fmtDate(c.businesses.created_at)}`}
                  {c.businesses.owner_id && (
                    <strong className="text-amber-600">
                      {" "}
                      · ya tiene dueño
                    </strong>
                  )}
                </p>
              )}
              <p className="text-xs text-gray-500">
                Reclamado por <strong>{c.claimer_email ?? "?"}</strong> ·{" "}
                {fmtDate(c.created_at)}
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
          {c.businesses && (
            <div className="flex gap-4 text-xs font-semibold text-primary">
              {c.businesses.is_active && (
                <a
                  href={`/negocios/${c.businesses.slug}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 hover:underline"
                >
                  <ExternalLink size={12} /> Ver ficha pública
                </a>
              )}
              <a
                href={`/app/negocios/${c.business_id}`}
                className="inline-flex items-center gap-1 hover:underline"
              >
                <Pencil size={12} /> Editar en el panel
              </a>
            </div>
          )}
        </li>
      ))}
      </ul>
    </div>
  );
}
