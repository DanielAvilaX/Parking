// Vercel serverless function (auto-detectada, sin configuración adicional).
// Sirve la config pública de Supabase desde variables de entorno, para que
// nunca queden credenciales escritas en el código fuente del repo.
module.exports = (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({
    url: process.env.SUPABASE_URL || '',
    anonKey: process.env.SUPABASE_ANON_KEY || '',
  });
};
