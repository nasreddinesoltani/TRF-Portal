# Deployment & Operations — rowingevents.tn

Production runs on a single Ubuntu VPS:

- **Frontend:** built with Vite into `frontend/dist` and served by the Node backend (Express `express.static`), fronted by **Nginx**.
- **Backend:** Node/Express (`backend/server.js`) on port **5000**, managed by **PM2** (process name `trf-portal`).
- **Nginx** reverse-proxies `/api` and `/uploads` to `http://127.0.0.1:5000` and serves the SPA.
- **Database:** MongoDB Atlas (connection string in `backend/.env`).

Repo path on the server: `/var/www/rowingevents.tn`

## Deploying

Run the deploy script on the server (aliased as `deployrowing`):

```bash
/var/www/rowingevents.tn/scripts/deploy-rowingevents.sh
```

It pulls code, installs deps, builds the frontend, (re)starts the backend under PM2, reloads Nginx, and runs a health check against `https://rowingevents.tn/api/health`.

## One-time PM2 setup (reboot safety)

PM2 must be registered with systemd so the backend restarts automatically after a server reboot. Run **once**:

```bash
pm2 start /var/www/rowingevents.tn/backend/server.js --name trf-portal
pm2 startup          # then run the "sudo env PATH=... pm2 startup systemd -u <user> --hp ..." line it prints
pm2 save             # freeze the current process list to /home/<user>/.pm2/dump.pm2
```

After this, the `pm2-<user>.service` systemd unit runs `pm2 resurrect` on boot and restores `trf-portal`. The deploy script also runs `pm2 save` after each deploy to keep the frozen list current.

## Troubleshooting

### 502 Bad Gateway (nginx)

Means Nginx is up but the backend isn't answering on port 5000.

```bash
pm2 status                       # is trf-portal "online"?
pm2 logs trf-portal --lines 40   # why did it crash / is it running?
sudo ss -ltnp | grep :5000       # is anything listening?
```

- **No process listed** → PM2 daemon is empty (e.g. after a reboot without the startup service). Start it: `pm2 start backend/server.js --name trf-portal`, then ensure `pm2 startup` + `pm2 save` are done.
- **Crash-loop with a MongoDB error** → check `backend/.env` `MONGO_URI` and that the server IP is allow-listed in MongoDB Atlas.
- **Listening on a different port** → make sure it matches Nginx's `proxy_pass` port (5000).

### "Connection Error – Unable to retrieve federation records" on the homepage

This is the frontend (`PublicHome.jsx`) reporting that `/api/public/competitions` failed — almost always the same 502 cause above. Fix the backend and it clears.

### Source-map / `installHook.js.map` console warning

Harmless. It comes from the React DevTools browser extension, not the app. Ignore it (or disable source maps in the browser DevTools settings).

## Dependency security

`npm audit` findings were remediated on YYYY (see git history):

- **Backend:** ran `npm audit fix` (non-breaking) and upgraded `multer` 1.4.5-lts → **2.x** and `nodemailer` 6.x → **9.x** (both API-compatible with existing code). Went from 12 vulnerabilities to 2 moderate.
- **Frontend:** ran `npm audit fix` (non-breaking) and upgraded `jspdf` 3.x → **4.x** with `jspdf-autotable` → **5.0.8** (resolves the only _critical_; production build verified, PDF export API unchanged). Went from 17 vulnerabilities to a small residual.

Intentionally **not** applied (would cause regressions, poor risk/benefit):

- **exceljs / uuid (moderate):** `npm audit fix --force` downgrades `exceljs` to 3.4.0, which would break the Excel export/import features. The `uuid` advisory only affects the `buf` argument to v3/v5/v6, which this code path does not use. Left as-is.
- **vite / esbuild (moderate, dev-only):** the advisory affects the Vite **dev server** only, not the production build/bundle. Upgrading to Vite 8 is a major toolchain jump; deferred. Not a production risk.

After any dependency change, run `npm run build` in `frontend/` and smoke-test PDF/Excel exports before deploying.

## History

An outage was traced to a server reboot leaving PM2's process list empty (nothing on port 5000 → 502). It was compounded by the deploy script using `set -euo pipefail` together with `pm2 restart`, which fails when the app isn't registered and aborted the deploy before Nginx reloaded. The script now falls back to `pm2 start` and runs `pm2 save`, and PM2 is registered with systemd for reboot safety.
