/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    user: import("@supabase/supabase-js").User | null;
    isAdmin: boolean;
    /** Barrio que corresponde al dominio del request (multi-barrio). */
    barrio: import("./lib/barrio").Barrio;
  }
}
