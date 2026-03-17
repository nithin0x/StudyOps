# StudyOps

StudyOps is a desktop-first study operations dashboard for certifications, labs, writeups, and Pomodoro tracking. User accounts, session auth, and app data now live on the backend instead of being stored only in the browser.

## Live WebSite
👉 [studyops.nithin0x.space](https://studyops.nithin0x.space/)

## Stack

- React
- Vite
- Express

## Local development

Install dependencies once:

```bash
npm install
```

Run the frontend and backend together:

```bash
npm run dev:all
```

Or run them separately:

```bash
npm run dev
npm run dev:server
```

The Vite app prefers `http://127.0.0.1:5173` and automatically falls back to the next open port if `5173` is busy. It proxies `/api` requests to the backend on `http://127.0.0.1:3001`.

## Build

```bash
npm run build
```

To serve the built frontend from the backend:

```bash
npm start
```

For a production install with only runtime dependencies:

```bash
npm install --omit=dev
npm run build
npm start
```

## Security and storage notes

- User profile data, study plans, labs, and activity logs are persisted server-side in `backend/data/store.json`.
- Passwords are hashed with Node's `crypto.scrypt`.
- Authentication uses `HttpOnly` session cookies with server-side session storage.
- API writes are validated on the server and rate limited.
- Static build assets are served with long-lived cache headers, while HTML and API responses are marked `no-store`.
- Session touch writes are throttled so authenticated requests do not rewrite the backing store on every hit.
- Vite and the React plugin were upgraded to clear the prior audit findings.
