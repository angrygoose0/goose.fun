/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "gateway.pinata.cloud",
        pathname: "/**", // Adjust pathname as needed
      },
      {
        protocol: "https",
        hostname: "via.placeholder.com",
        pathname: "/**", // Adjust pathname as needed
      },
    ],
  },
};

export default nextConfig;