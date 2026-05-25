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

export const supabase = createClient(runtimeConfig.supabaseUrl, runtimeConfig.supabaseAnonKey, {
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

