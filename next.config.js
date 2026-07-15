/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      {
        source: "/favicon.ico",
        destination: "/brand/favicon-192.png",
        permanent: false,
      },
    ];
  },
};

module.exports = nextConfig;
