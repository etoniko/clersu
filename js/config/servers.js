/** Game server on VPS (plain WS on :6010 — no TLS on this port). */
export const SERVER_WS_URL = "ws://ffa.agar.su:6010";

/** HTTP base for /stats (same host/port as WS). */
export const SERVER_HTTP_URL = SERVER_WS_URL.replace(/^ws/i, "http");
