import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  transpilePackages: ["@computer-oss/protocol"],
  outputFileTracingRoot: path.join(currentDirectory, "../../")
};

export default nextConfig;
