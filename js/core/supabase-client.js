import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { runtimeConfig } from "../config/runtime-config.js";
import { createRoleAwareStorage } from "./storage.js";
import { beginLoading, endLoading } from "../ui/loader.js";

export const authStorage = createRoleAwareStorage(runtimeConfig.authStorageKey);

async function trackedFetch(input, init) {
  beginLoading();
  try {
    return await fetch(input, init);
  } finally {
    endLoading();
  }
}

async function loadSupabaseConfig() {
  try {
    const res = await fetch("/api/config");
    if (!res.ok) throw new Error("config endpoint unavailable");
    return await res.json();
  } catch {
    return { url: "", anonKey: "" };
  }
}

const { url: supabaseUrl, anonKey: supabaseAnonKey } = await loadSupabaseConfig();

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    "Supabase no está configurado: faltan SUPABASE_URL / SUPABASE_ANON_KEY en el entorno (revisa /api/config)."
  );
}

// createClient exige una URL/key con formato válido aunque estén vacías —
// usamos un placeholder para no romper la carga del módulo en todas las
// páginas; las llamadas a la API simplemente fallarán hasta configurarlas.
export const supabase = createClient(supabaseUrl || "https://placeholder.supabase.co", supabaseAnonKey || "placeholder", {
  auth: {
    autoRefreshToken: true,
    detectSessionInUrl: true,
    persistSession: true,
    storageKey: runtimeConfig.authStorageKey,
    storage: authStorage,
  },
  global: {
    fetch: trackedFetch,
  },
});

