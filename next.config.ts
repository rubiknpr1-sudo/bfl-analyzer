import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfjs-dist не бандлим: иначе теряется pdf.worker.mjs (fake worker) на сервере
  serverExternalPackages: ["pdfjs-dist"],
};

export default nextConfig;
