import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes:{'/api/five-s/plans':['./private/plans/**'],'/api/excel':['./private/templates/**','./data/templates.json']},
};

export default nextConfig;
