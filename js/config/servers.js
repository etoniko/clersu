/**
 * Game WebSocket endpoint.
 * Production VPS (SSL via nginx): wss://ffa.agar.su
 * Local server: ws://localhost:3000
 */
const isLocal =
  typeof location !== "undefined" &&
  (location.hostname === "localhost" ||
    location.hostname === "127.0.0.1" ||
    location.hostname === "");

export const SERVER_WS_URL = isLocal
  ? `${location.protocol === "https:" ? "wss" : "ws"}://${location.hostname || "localhost"}:3000`
  : "wss://ffa.agar.su";
