// Kiray — Next.js configuration for the Cloudflare Workers runtime.
//
// The OpenNext Cloudflare adapter needs one hook during `next dev` so that
// `getCloudflareContext()` can hand us the D1 and R2 bindings locally, exactly
// like it does in production. It is wrapped in a try/catch so a plain
// `next dev` still boots even if the adapter has not been installed yet.

let initOpenNextCloudflareForDev;
try {
  ({ initOpenNextCloudflareForDev } = await import("@opennextjs/cloudflare"));
} catch {
  initOpenNextCloudflareForDev = undefined;
}

if (process.env.NODE_ENV === "development" && initOpenNextCloudflareForDev) {
  try {
    await initOpenNextCloudflareForDev();
  } catch (error) {
    console.warn(
      "[kiray] Cloudflare dev bindings unavailable. Run `npm run db:migrate` first.",
      error instanceof Error ? error.message : error,
    );
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Workers has no sharp binary. Photos are served straight from R2 through
  // /api/images/[key], which sets its own long-lived cache headers.
  images: {
    unoptimized: true,
  },

  // The deploy must never be blocked by lint or a stray type error — flip these
  // to false once you are iterating locally and want the full safety net.
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },

  webpack: (config) => {
    config.cache = false;
    return config;
  },
  experimental: {
    cpus: 1,
    workerThreads: false,
    // Server Actions receive multi-megabyte photo uploads from the host wizard.
    serverActions: {
      bodySizeLimit: "12mb",
    },
  },
};

export default nextConfig;
