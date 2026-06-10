import "@/lib/load-env";

import { createServer } from "node:http";
import { Server } from "socket.io";
import { evaluateAllowlist, normalizeEmail } from "@/lib/auth/allowlist";
import { connectToDatabase } from "@/lib/db";
import { getServerEnv, getSocketEnv } from "@/lib/env";
import { getAdminAuth } from "@/lib/firebase-admin";
import { AllowlistEntry } from "@/lib/models/AllowlistEntry";

interface SocketUser {
  uid: string;
  email: string;
  role: "user" | "admin";
}

async function main() {
  const socketEnv = getSocketEnv();
  getServerEnv(); // fail fast on missing credentials
  await connectToDatabase();

  const httpServer = createServer((req, res) => {
    if (req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok" }));
      return;
    }
    res.writeHead(404);
    res.end();
  });

  const io = new Server(httpServer, {
    cors: {
      origin: socketEnv.SOCKET_CORS_ORIGIN.split(","),
      credentials: true,
    },
  });

  // Every connection must present a valid Firebase ID token for an
  // allowlisted account. Draft handlers (Phase 4) build on socket.data.user.
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (typeof token !== "string" || token.length === 0) {
        return next(new Error("unauthorized"));
      }
      const decoded = await getAdminAuth().verifyIdToken(token);
      const email = normalizeEmail(decoded.email ?? "");
      const entry = await AllowlistEntry.findOne({ email }).lean();
      const decision = evaluateAllowlist(entry);
      if (!decision.allowed) return next(new Error("unauthorized"));
      socket.data.user = {
        uid: decoded.uid,
        email,
        role: decision.role,
      } satisfies SocketUser;
      next();
    } catch {
      next(new Error("unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    const user = socket.data.user as SocketUser;
    console.log(`[socket] connected: ${user.email}`);
    socket.on("disconnect", (reason) => {
      console.log(`[socket] disconnected: ${user.email} (${reason})`);
    });
  });

  httpServer.listen(socketEnv.SOCKET_PORT, () => {
    console.log(`[socket] listening on :${socketEnv.SOCKET_PORT}`);
  });
}

main().catch((error) => {
  console.error(
    "[socket] failed to start:",
    error instanceof Error ? error.message : error,
  );
  process.exit(1);
});
