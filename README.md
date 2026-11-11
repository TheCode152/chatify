# Chatify

A real chat website: accounts, private channels, announcements, banned words and an admin panel. Made by ZanMan.

No dependencies. You only need Node.js 18 or newer.

## Run it
```
ADMIN_CODE=your-secret-code node server.js
```
Open http://localhost:3000. Data is saved in `data/db.json`.

## Put it online
- **Render / Railway / Fly.io:** upload this folder (or push it to GitHub), set the start command to `node server.js`, add the variables from `.env.example`, and attach a persistent disk, pointing `DATA_DIR` at it. Without a disk, accounts are lost on every redeploy.
- **Docker:** `docker build -t chatify . && docker run -p 3000:3000 -v chatify-data:/data -e ADMIN_CODE=your-secret-code chatify`
- **Your own server (VPS):** run it with pm2 or systemd, and put Caddy or nginx in front for HTTPS and your domain.

Always serve it over HTTPS online (`NODE_ENV=production` makes cookies Secure).

## Environment variables
| Name | Meaning |
|---|---|
| `ADMIN_CODE` | Code that unlocks the admin panel. If unset, the admin panel is disabled. |
| `PORT` | Port to listen on (default 3000). |
| `DATA_DIR` | Where `db.json` is stored. |
| `NODE_ENV` | Set to `production` online. |

## How it's built
- Passwords hashed with scrypt; login uses HttpOnly session cookies (30 days).
- Private channels, banned words and the admin code are all enforced on the server.
- Live messages use Server-Sent Events. Logins and messages are rate limited.
- One server only: data lives in a single JSON file, which suits small communities. For thousands of users, swap it for a database such as PostgreSQL.

## bot-hosting.cloud and other Pterodactyl-style panels
1. Upload the files so that `index.js`, `server.js`, `package.json` and the `public` folder are in the **root** of your server (not inside a `chatify` folder).
2. Set the startup/main file to `index.js`.
3. Add a variable `ADMIN_CODE` in the Startup/Variables tab (or create a `.env`-style variable your panel supports).
4. The server automatically uses the panel's `SERVER_PORT`. Open `http://your-address:PORT`.
5. Plain `http://` works: login cookies only use the Secure flag when the site is served over HTTPS.

## Features (v2)
- Accounts with unique names (usernames and display names can never match another person's). The name `admin` is reserved: signing up with it asks for your `ADMIN_CODE`. The `admin` account can give badges (Chatify Admin, Cook Ranger, Known) from anyone's profile.
- Servers with join codes, roles, and private channels limited to chosen roles. Everyone is placed in the main "Chatify" server.
- Image sharing (.png, .jpg, .webp, up to 5 MB, checked by real file contents). Uploads are saved in `DATA_DIR/uploads`, so keep `DATA_DIR` on persistent storage.
- Profiles (display name, description, picture), a leaderboard with online/typing status, right-click delete on your own messages, admin panel, announcements (also shown on the login screen).
