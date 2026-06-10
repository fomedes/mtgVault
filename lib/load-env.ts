import path from "node:path";
import { config } from "dotenv";

/**
 * Side-effect import for processes that run outside Next.js (Socket.io
 * server, CLI scripts). Next.js loads .env.local natively and must NOT
 * import this module.
 */
config({ path: path.resolve(process.cwd(), ".env.local") });
config({ path: path.resolve(process.cwd(), ".env") });
