import { useEffect, useState } from "react";
import {
  Eye,
  MessageCircle,
  PhoneCall,
  Globe,
  TrendingUp,
  TrendingDown,
  Minus,
  Lock,
} from "lucide-react";
import { supabaseBrowser } from "../../lib/supabase/browser";
import InstagramIcon from "../icons/InstagramIcon";

type Props = {
  businessId: string;
  isFeatured: boolean;
};

type StatRow = {
  event: string;
  current_total: number;
  previous_total: number;
};

const LABELS: Record<string, { label: string; icon: any }> = {
  view: { label: "Vieron tu ficha", icon: Eye },
  whatsapp: { label: "Te escribieron por WhatsApp", icon: MessageCircle },
  phone: { label: "Tocaron para llamarte", icon: PhoneCall },
  instagram: { label: "Fueron a tu Instagram", icon: InstagramIcon },
  website: { label: "Visitaron tu web", icon: Globe },
};

const ORDER = ["view", "whatsapp", "phone", "instagram", "website"];

function Delta({ current, previous }: { current: number; previous: number }) {
  if (previous === 0 && current === 0)
    return <Minus size={14} className="text-gray-300" />;
  if (current > previous)
    return (
      <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-green-600">
        <TrendingUp size={13} /> +{current - previous}
      </span>
    );
  if (current < previous)
    return (
      <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-red-500">
        <TrendingDown size={13} /> −{previous - current}
      </span>
    );
  return <Minus size={14} className="text-gray-300" />;
}

export default function StatsCard({ businessId, isFeatured }: Props) {
  const [stats, setStats] = useState<StatRow[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    supabaseBrowser
      .rpc("get_business_stats", { p_business_id: businessId, p_days: 30 })
      .then(({ data, error }) => {
        if (error) {
          console.error(error);
          setError(true);
        } else {
          setStats((data as StatRow[]) ?? []);
        }
      });
  }, [businessId]);

  if (error) return null;

  if (!stats) {
    return <p className="text-sm text-gray-400">Cargando estadísticas…</p>;
  }

  const total = stats.reduce((acc, s) => acc + Number(s.current_total), 0);
  const totalPrev = stats.reduce((acc, s) => acc + Number(s.previous_total), 0);

  // Plan gratuito: solo el total, con el detalle como gancho
  if (!isFeatured) {
    return (
      <div className="space-y-4">
        <div className="flex items-end gap-3">
          <p className="text-4xl font-extrabold text-gray-900">{total}</p>
          <p className="pb-1 text-sm text-gray-600">
            interacciones de vecinos con tu negocio en los últimos 30 días
          </p>
        </div>

        <div className="relative overflow-hidden rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <Lock size={18} className="mt-0.5 shrink-0 text-amber-600" />
            <p className="text-sm text-amber-800">
              ¿Cuántos <strong>vieron tu ficha</strong>? ¿Cuántos te{" "}
              <strong>escribieron por WhatsApp</strong> o{" "}
              <strong>tocaron para llamarte</strong>? Con el{" "}
              <strong>plan Destacado</strong> ves el detalle completo y la
              tendencia mes a mes.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Plan Destacado: detalle completo con tendencia
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {ORDER.filter((ev) => LABELS[ev]).map((ev) => {
          const row = stats.find((s) => s.event === ev);
          const current = Number(row?.current_total ?? 0);
          const previous = Number(row?.previous_total ?? 0);
          const { label, icon: Icon } = LABELS[ev];
          if (ev !== "view" && current === 0 && previous === 0) return null;
          return (
            <div
              key={ev}
              className="flex items-center gap-3 rounded-xl bg-gray-50 px-4 py-3"
            >
              <Icon size={20} className="shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="text-xl font-bold leading-tight text-gray-900">
                  {current}
                </p>
                <p className="truncate text-xs text-gray-500">{label}</p>
              </div>
              <Delta current={current} previous={previous} />
            </div>
          );
        })}
      </div>

      <p className="text-xs text-gray-400">
        Últimos 30 días · la flecha compara contra los 30 anteriores
      </p>
    </div>
  );
}
