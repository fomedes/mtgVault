import mongoose from "mongoose";
import { getServerEnv } from "@/lib/env";

/**
 * The connection promise is cached on globalThis so Next.js dev hot reloads
 * reuse one connection instead of exhausting the Atlas connection pool.
 */
const globalForMongoose = globalThis as unknown as {
  mongooseConn?: Promise<typeof mongoose>;
};

export function connectToDatabase(): Promise<typeof mongoose> {
  if (!globalForMongoose.mongooseConn) {
    globalForMongoose.mongooseConn = mongoose
      .connect(getServerEnv().MONGODB_URI, { dbName: "mtg-vault" })
      .catch((error) => {
        globalForMongoose.mongooseConn = undefined;
        throw error;
      });
  }
  return globalForMongoose.mongooseConn;
}
