// In development VITE_SERVER_URL is unset — Vite's proxy forwards /api, /auth, /socket.io
// In production (Vercel) set it to your Heroku app URL, e.g. https://sheettotimer.herokuapp.com
export const SERVER_URL = (import.meta.env.VITE_SERVER_URL as string | undefined) ?? '';

export const apiUrl = (path: string) => `${SERVER_URL}${path}`;
