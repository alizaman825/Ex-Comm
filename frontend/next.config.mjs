/** @type {import('next').NextConfig} */
// Strip a trailing slash so a BACKEND_URL set with one (e.g. "https://host.onrender.com/")
// doesn't turn the rewrite below into a double slash ("…onrender.com//api/health"), which the
// backend's router treats as a different, unmatched path and 404s on.
const backend = (process.env.BACKEND_URL || "http://127.0.0.1:5000").replace(/\/+$/, "");

const nextConfig = {
  // End-to-end tests build into their own folder so they never clash with a running dev server.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  reactStrictMode: true,
  poweredByHeader: false,
  // The browser talks to this origin only; /api/* is proxied to the Express backend, so the
  // httpOnly session cookie is first-party and no CORS setup is needed.
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${backend}/api/:path*` }];
  },
};

export default nextConfig;
