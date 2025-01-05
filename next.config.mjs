/** @type {import('next').NextConfig} */
const nextConfig = {
    output: "standalone",
    images: {
        domains: ['gateway.pinata.cloud'],
        domains: ['via.placeholder.com'],
      },
};

export default nextConfig;
