// Config pública y no-secreta. Las credenciales de Supabase NO viven aquí —
// se obtienen en tiempo de ejecución desde /api/config (ver supabase-client.js).
export const runtimeConfig = Object.freeze({
  siteName: "Portería 360",
  authStorageKey: "porteria360-auth-session",
});

