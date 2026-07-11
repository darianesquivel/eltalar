import { useState } from "react";
import { supabaseBrowser } from "../../lib/supabase/browser";

type Props = {
  businessId: string;
  businessName: string;
};

export default function ClaimForm({ businessId, businessName }: Props) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError(null);

    try {
      const {
        data: { user },
      } = await supabaseBrowser.auth.getUser();
      if (!user) throw new Error("Sesión expirada, volvé a ingresar");

      const { error: insError } = await supabaseBrowser
        .from("business_claims")
        .insert({
          business_id: businessId,
          user_id: user.id,
          claimer_email: user.email,
          message: message.trim() || null,
        });

      if (insError) {
        if (insError.code === "23505") {
          throw new Error(
            "Ya enviaste un reclamo por este negocio. Está en revisión.",
          );
        }
        throw insError;
      }

      setSent(true);
    } catch (err: any) {
      console.error(err);
      setError(err.message ?? "No pudimos enviar el reclamo");
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <div className="rounded-2xl bg-green-50 p-6 text-center space-y-2">
        <p className="text-lg font-bold text-green-700">✓ Reclamo enviado</p>
        <p className="text-sm text-green-600">
          Vamos a verificar que «{businessName}» sea tuyo y te lo asignamos. Vas
          a verlo en tu panel cuando esté aprobado.
        </p>
        <a
          href="/app"
          className="inline-block rounded-full bg-primary px-6 py-2 text-sm font-semibold text-white"
        >
          Ir a mi panel
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-semibold">
          Contanos por qué este negocio es tuyo
        </label>
        <textarea
          rows={4}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Ej: Soy el dueño, atiendo en el local de lunes a viernes. Mi teléfono es…"
          className="field resize-none"
        />
        <p className="mt-1 text-xs text-gray-400">
          Cuanta más info nos des (teléfono del local, redes, etc.), más rápido
          lo verificamos.
        </p>
      </div>

      {error && (
        <p className="rounded-xl bg-red-50 p-3 text-sm text-red-600">{error}</p>
      )}

      <button
        type="submit"
        disabled={sending}
        className="w-full rounded-xl bg-primary px-6 py-3 font-semibold text-white transition hover:bg-green-700 disabled:opacity-60"
      >
        {sending ? "Enviando…" : "Reclamar este negocio"}
      </button>
    </form>
  );
}
