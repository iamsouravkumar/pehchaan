import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Static export only. There is no server runtime in production (TRD §1).
  output: 'export',
  images: { unoptimized: true },
  // Emit tool/index.html rather than tool.html. Without this, /tool is a 404 on
  // any host that doesn't guess at extensions: GitHub Pages and a plain file
  // server included.
  trailingSlash: true,
};

export default nextConfig;
