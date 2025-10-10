// apps/matching/next.config.js
// Configuration for therapy-matching-only deployment
// This allows deploying the same codebase to matching.risetwice.com with / → /chatbotV17

module.exports = {
  // Allow Next.js to import from parent directories (access root /src)
  experimental: {
    externalDir: true,
  },

  // Rewrite root path to therapy matching page
  async rewrites() {
    return [
      {
        source: '/',
        destination: '/chatbotV17',
      },
    ];
  },
};
