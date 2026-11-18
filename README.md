# Wedding Invitation and QR Attendance PWA

## 1. Supabase
1. Create a project. In Authentication > Users, create 3 users (1 administrator, 2 ushers).
2. Run `schema.sql` in the SQL editor, then uncomment and fill in the `profiles` insert at the bottom with the three user IDs.
3. In the app, sign in as the administrator and complete Settings, Tables, Guests, then Invitations.

## 2. Backend (`server/`)
```
cd server && cp .env.example .env   # fill in values; the service-role key stays here only
npm install && npm run dev
```

## 3. Frontend (project root)
```
cp .env.example .env                # Supabase URL, anon key, API URL
npm install
npm run dev
```

## 4. Test the PWA (the service worker is off in `npm run dev`)
```
npm run build && npm run preview
```
Open the preview over HTTPS (or localhost) and check: install prompt, standalone mode, offline page, and the update prompt after a second build. In Chrome use DevTools > Application. Camera access needs HTTPS or localhost.

## 5. Deploy over HTTPS
Static hosting works for the frontend (`dist/`); `public/_headers` and `public/_redirects` are for Netlify or Cloudflare Pages. On other hosts, copy the same rules: single-page fallback to `/index.html`, `no-cache` on `sw.js`, `index.html` and `manifest.webmanifest`, and `Permissions-Policy: camera=(self)`. Deploy `server/` to any Node 20+ host. Set `APP_URL` on the server to the frontend's HTTPS address, and `VITE_API_URL` at build time to the backend's address.

## Installing on phones
- Android (Chrome): use the Install button in the app, or menu > Install app.
- iPhone (Safari only): Share > Add to Home Screen.

## What is never cached
Only the public app shell is precached. The API, Supabase calls, guest data and QR verification responses always go to the network (`src/sw.js`).
