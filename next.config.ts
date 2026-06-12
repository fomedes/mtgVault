import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "mongoose",
    "firebase-admin",
    "jose",
    "jwks-rsa",
    "@google-cloud/firestore",
    "@google-cloud/storage",
  ],
  images: {
    remotePatterns: [
      // Scryfall card imagery (Phase 1+)
      { protocol: "https", hostname: "cards.scryfall.io" },
      { protocol: "https", hostname: "svgs.scryfall.io" },
      // Google account avatars
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },
  allowedDevOrigins: ["192.168.0.190"],
};

export default nextConfig;
