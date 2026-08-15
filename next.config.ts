import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Static export only. There is no server runtime in production — see TRD §1.
  output: 'export',
  images: { unoptimized: true },
};

export default nextConfig;
