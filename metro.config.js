const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Custom resolver to redirect zustand ESM to CJS
const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Force zustand to use CJS by redirecting to the vanilla/index.js
  if (platform === 'web' && moduleName === 'zustand/middleware') {
    return {
      filePath: path.resolve(__dirname, 'node_modules/zustand/middleware.js'),
      type: 'sourceFile',
    };
  }
  if (platform === 'web' && moduleName === 'zustand') {
    return {
      filePath: path.resolve(__dirname, 'node_modules/zustand/index.js'),
      type: 'sourceFile',
    };
  }

  // Use default resolver for everything else
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
