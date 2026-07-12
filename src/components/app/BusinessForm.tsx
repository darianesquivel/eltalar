import { useState } from "react";
import { supabaseBrowser } from "../../lib/supabase/browser";
import type { Category } from "../../lib/repositories/business.repository";

type BusinessFormData = {
  id?: string;
  name: string;
  description: string | null;
  address: string | null;
  phone: string | null;
  whatsapp: string | null;
  instagram: string | null;
  website: string | null;
  services?: string | null;
};

type Props = {
  categories: Category[];
  /** Si viene, es edición; si no, alta. */
  business?: BusinessFormData;
  /** IDs de categorías ya asignadas (en edición). */
  selectedCategoryIds?: string[];
  /** Habilita la carga administrativa (negocio sin dueño, reclamable). */
  isAdmin?: boolean;
  /** El plan Destacado desbloquea la lista de servicios y precios. */
  isFeatured?: boolean;
};

const slugify = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // saca tildes
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const inputClass = "field";

export default function BusinessForm({
  categories,
  business,
  selectedCategoryIds = [],
  isAdmin = false,
  isFeatured = false,
}: Props) {
  const isEdit = Boolean(business?.id);
  const [adminNoOwner, setAdminNoOwner] = useState(isAdmin);

  const [form, setForm] = useState<BusinessFormData>({
    name: business?.name ?? "",
    description: business?.description ?? "",
    address: business?.address ?? "",
    phone: business?.phone ?? "",
    whatsapp: business?.whatsapp ?? "",
    instagram: business?.instagram ?? "",
    website: business?.website ?? "",
    services: business?.services ?? "",
  });
  const [selectedCats, setSelectedCats] =
    useState<string[]>(selectedCategoryIds);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const set = (field: keyof BusinessFormData) => (e: any) => {
    setForm({ ...form, [field]: e.target.value });
    setSaved(false);
  };

  const toggleCat = (id: string) => {
    setSelectedCats((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );
    setSaved(false);
  };

  const syncCategories = async (businessId: string) => {
    await supabaseBrowser
      .from("business_categories")
      .delete()
      .eq("business_id", businessId);

    if (selectedCats.length > 0) {
      await supabaseBrowser.from("business_categories").insert(
        selectedCats.map((category_id) => ({
          business_id: businessId,
          category_id,
        })),
      );
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      if (!form.name.trim()) throw new Error("El nombre es obligatorio");

      const payload = {
        name: form.name.trim(),
        description: form.description || null,
        address: form.address || null,
        phone: form.phone || null,
        whatsapp: form.whatsapp || null,
        instagram: form.instagram || null,
        website: form.website || null,
        services: form.services || null,
      };

      if (isEdit) {
        const { error: updateError } = await supabaseBrowser
          .from("businesses")
          .update(payload)
          .eq("id", business!.id!);
        if (updateError) throw updateError;

        await syncCategories(business!.id!);
        setSaved(true);
      } else {
        const {
          data: { user },
        } = await supabaseBrowser.auth.getUser();
        if (!user) throw new Error("Sesión expirada, volvé a ingresar");

        let slug = slugify(form.name);

        // Reintento con sufijo si el slug ya existe
        for (let attempt = 0; attempt < 3; attempt++) {
          const { data, error: insertError } = await supabaseBrowser
            .from("businesses")
            .insert({
              ...payload,
              slug,
              // Carga administrativa: sin dueño, el comerciante lo reclama después
              owner_id: isAdmin && adminNoOwner ? null : user.id,
            })
            .select("id")
            .single();

          if (!insertError && data) {
            await syncCategories(data.id);
            window.location.href = `/app/negocios/${data.id}?creado=1`;
            return;
          }

          if (insertError?.code === "23505") {
            slug = `${slugify(form.name)}-${Math.random().toString(36).slice(2, 6)}`;
            continue;
          }

          throw insertError;
        }
        throw new Error("No pudimos generar una URL única, probá otro nombre");
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message ?? "Error guardando los datos");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {isAdmin && !isEdit && (
        <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm">
          <input
            type="checkbox"
            checked={adminNoOwner}
            onChange={(e) => setAdminNoOwner(e.target.checked)}
            className="h-4 w-4"
          />
          <span>
            <strong>Carga administrativa</strong> — el negocio queda sin dueño y
            el comerciante puede reclamarlo desde su ficha.
          </span>
        </label>
      )}

      <div>
        <label className="mb-1 block text-sm font-semibold">
          Nombre del negocio *
        </label>
        <input
          required
          value={form.name}
          onChange={set("name")}
          placeholder="Ej: Panadería La Espiga"
          className={inputClass}
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-semibold">Descripción</label>
        <textarea
          rows={4}
          value={form.description ?? ""}
          onChange={set("description")}
          placeholder="Contale a tus vecinos qué ofrecés…"
          className={`${inputClass} resize-none`}
        />
      </div>

      {isEdit && (
        <div>
          <label className="mb-1 block text-sm font-semibold">
            Servicios y precios{" "}
            {!isFeatured && (
              <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                ⭐ Destacado
              </span>
            )}
          </label>
          {isFeatured ? (
            <>
              <textarea
                rows={5}
                value={form.services ?? ""}
                onChange={set("services")}
                placeholder={
                  "Uno por línea, ej:\nCorte de pelo — $8.000\nColor — desde $25.000"
                }
                className={`${inputClass} resize-none`}
              />
              <p className="mt-1 text-xs text-gray-400">
                Se muestran como lista en tu ficha. Un servicio por línea.
              </p>
            </>
          ) : (
            <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              Con el <strong>plan Destacado</strong> podés publicar tu lista de
              servicios y precios en la ficha.
            </p>
          )}
        </div>
      )}

      <div>
        <label className="mb-1 block text-sm font-semibold">Rubros</label>
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <button
              type="button"
              key={cat.id}
              onClick={() => toggleCat(cat.id)}
              className={`rounded-full border px-4 py-1.5 text-sm transition ${
                selectedCats.includes(cat.id)
                  ? "border-primary bg-primary text-white"
                  : "border-gray-200 bg-white text-gray-600 hover:border-primary/50"
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-semibold">Dirección</label>
          <input
            value={form.address ?? ""}
            onChange={set("address")}
            placeholder="Av. H. Yrigoyen 1234, El Talar"
            className={inputClass}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-semibold">Teléfono</label>
          <input
            value={form.phone ?? ""}
            onChange={set("phone")}
            placeholder="011 4740-0000"
            className={inputClass}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-semibold">
            WhatsApp (con 549 adelante)
          </label>
          <input
            value={form.whatsapp ?? ""}
            onChange={set("whatsapp")}
            placeholder="5491122334455"
            className={inputClass}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-semibold">Instagram</label>
          <input
            value={form.instagram ?? ""}
            onChange={set("instagram")}
            placeholder="Tu usuario (ej: @tunegocio) o el link"
            className={inputClass}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-sm font-semibold">Sitio web</label>
          <input
            value={form.website ?? ""}
            onChange={set("website")}
            placeholder="https://…"
            className={inputClass}
          />
        </div>
      </div>

      {error && (
        <p className="rounded-xl bg-red-50 p-3 text-sm text-red-600">{error}</p>
      )}
      {saved && (
        <p className="rounded-xl bg-green-50 p-3 text-sm text-green-700">
          ✓ Cambios guardados
        </p>
      )}

      <button
        type="submit"
        disabled={saving}
        className="w-full rounded-xl bg-primary px-6 py-3 font-semibold text-white transition hover:bg-green-700 disabled:opacity-60 sm:w-auto"
      >
        {saving ? "Guardando…" : isEdit ? "Guardar cambios" : "Crear negocio"}
      </button>
    </form>
  );
}
