# SETUP — one-time service configuration

Everything in the repo runs without credentials except live sign-in and the
Socket.io server. This guide creates the two external services and wires them
into `.env.local`. Allow ~15 minutes.

## 1. Firebase (authentication)

1. Go to [console.firebase.google.com](https://console.firebase.google.com) → **Add project** → name it `mtg-vault` (Analytics: off is fine).
2. **Build → Authentication → Get started → Sign-in method**: enable **Google**. Set a support email when prompted.
3. **Project settings (gear) → General → Your apps → Web app (`</>`)**: register an app named `mtg-vault-web` (no hosting). Copy from the config snippet into `.env.local`:
   - `apiKey` → `NEXT_PUBLIC_FIREBASE_API_KEY`
   - `authDomain` → `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
   - `projectId` → `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
   - `appId` → `NEXT_PUBLIC_FIREBASE_APP_ID`
4. **Project settings → Service accounts → Generate new private key** — downloads a JSON file. From it:
   - `project_id` → `FIREBASE_ADMIN_PROJECT_ID`
   - `client_email` → `FIREBASE_ADMIN_CLIENT_EMAIL`
   - `private_key` → `FIREBASE_ADMIN_PRIVATE_KEY` — paste the whole value **in double quotes, keeping the `\n` sequences on one line**, e.g.
     ```
     FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQ...\n-----END PRIVATE KEY-----\n"
     ```
   - Delete or safely store the JSON file. **Never commit it.**
5. **Authentication → Settings → Authorized domains**: `localhost` is pre-authorized; add your Vercel domain when Phase 1 deploys.

## 2. MongoDB Atlas (database)

1. Go to [cloud.mongodb.com](https://cloud.mongodb.com) → create a free **M0** cluster (any nearby region).
2. **Database Access**: add a database user (username + strong password, role "Read and write to any database").
3. **Network Access**: add your current IP. (For Render later: allow `0.0.0.0/0` — credentials still required — or use Render's static outbound IPs.)
4. **Connect → Drivers**: copy the connection string, substitute the password, and set it as `MONGODB_URI`. No need to put a database name in the path — the app always uses `mtg-vault`.

## 3. Allowlist yourself

```bash
pnpm seed:allowlist --email fomedes.dev@gmail.com --role admin
```

Add friends the same way with `--role user` (later phases add an admin UI for this).

## 4. Verify (Phase 0 exit criteria)

1. `pnpm dev` → open http://localhost:3000 → redirected to `/login`.
2. Sign in with the allowlisted Google account → you land on the dashboard.
3. Sign in with a non-allowlisted account → "You're not on the list" message, no session.
4. `pnpm dev:socket` → console shows `[socket] listening on :4000` and http://localhost:4000/health returns `{"status":"ok"}`.
5. `pnpm test && pnpm lint && pnpm typecheck && pnpm build` → all green.
