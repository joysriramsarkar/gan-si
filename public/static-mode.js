/* Local / self-hosted build: a full Express + SQLite backend is available.
   The Vercel build (scripts/mark-static.cjs) overwrites this file to true,
   so the frontend never makes an /api/* request on a static-only host. */
window.GANSI_STATIC_MODE = false;
