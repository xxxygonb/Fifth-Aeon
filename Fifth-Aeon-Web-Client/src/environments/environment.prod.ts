// Production build: connects to the game server (WebSocket + REST API).
// The server address comes from src/app/url.ts / user/authentication.service.ts.
export const environment = {
  production: true,
  serverless: false
};
