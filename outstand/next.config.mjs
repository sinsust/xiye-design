/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Pin the workspace root — there are unrelated lockfiles further up the tree.
  outputFileTracingRoot: import.meta.dirname,
  images: {
    // All imagery is self-hosted under /public/assets — no remote patterns needed.
    formats: ['image/avif', 'image/webp'],
  },
};

export default nextConfig;
