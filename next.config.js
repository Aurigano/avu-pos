/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    // Exclude PouchDB and related packages from server-side bundling
    if (isServer) {
      config.externals = config.externals || []
      config.externals.push({
        'pouchdb': 'commonjs pouchdb',
        'pouchdb-find': 'commonjs pouchdb-find',
        'pouchdb-adapter-http': 'commonjs pouchdb-adapter-http'
      })
    }
    
    return config
  },
  // Disable static optimization for pages that use PouchDB
  experimental: {
    esmExternals: 'loose'
  }
}

module.exports = nextConfig 