/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      {
        source: "/",
        has: [{ type: "host", value: "scarlettmay.online" }],
        destination: "/scarlett",
        permanent: false,
      },
      {
        source: "/",
        has: [{ type: "host", value: "creativeq.online" }],
        destination: "/machine/store",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
