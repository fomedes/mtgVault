import { z } from "zod";

/**
 * Env access is lazy (validated on first use, not at import) so that
 * `next build` and CI succeed without real credentials.
 */

export const serverEnvSchema = z.object({
  MONGODB_URI: z.string().min(1),
  FIREBASE_ADMIN_PROJECT_ID: z.string().min(1),
  FIREBASE_ADMIN_CLIENT_EMAIL: z.string().min(1),
  FIREBASE_ADMIN_PRIVATE_KEY: z.string().min(1),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export const socketEnvSchema = z.object({
  SOCKET_PORT: z.coerce.number().int().positive().default(4000),
  SOCKET_CORS_ORIGIN: z.string().min(1).default("http://localhost:3000"),
});

export type SocketEnv = z.infer<typeof socketEnvSchema>;

/** Env files (and some dashboards) store the key with literal \n sequences. */
export function normalizePrivateKey(key: string): string {
  return key.replace(/\\n/g, "\n");
}

function formatIssues(error: z.ZodError): string {
  return error.issues.map((issue) => issue.path.join(".")).join(", ");
}

let cachedServerEnv: ServerEnv | null = null;

export function getServerEnv(): ServerEnv {
  if (cachedServerEnv) return cachedServerEnv;
  const parsed = serverEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(
      `Invalid server environment — check .env.local (see .env.local.example). Problem with: ${formatIssues(parsed.error)}`,
    );
  }
  cachedServerEnv = {
    ...parsed.data,
    FIREBASE_ADMIN_PRIVATE_KEY: normalizePrivateKey(
      parsed.data.FIREBASE_ADMIN_PRIVATE_KEY,
    ),
  };
  return cachedServerEnv;
}

let cachedSocketEnv: SocketEnv | null = null;

export function getSocketEnv(): SocketEnv {
  if (cachedSocketEnv) return cachedSocketEnv;
  const parsed = socketEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(
      `Invalid socket server environment. Problem with: ${formatIssues(parsed.error)}`,
    );
  }
  cachedSocketEnv = parsed.data;
  return cachedSocketEnv;
}
