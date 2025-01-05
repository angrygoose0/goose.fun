/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  images: {
    domains: ['gateway.pinata.cloud', 'via.placeholder.com'], // Combine the domains into one array
  },
};

export default nextConfig;