// https://docs.expo.dev/guides/customizing-metro/
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Disable the experimental package exports resolver.
// react-i18next's `exports` field points to an ES module build that Metro
// cannot handle. Disabling this makes Metro fall back to the `main` field
// (dist/commonjs/index.js) which works correctly.
config.resolver.unstable_enablePackageExports = false;

// Force axios to resolve to its browser build instead of the Node.js build.
// The Node.js build (dist/node/axios.cjs) imports `crypto`, `http`, etc.
// which are unavailable in React Native.
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
    if (moduleName === 'axios') {
        return {
            filePath: path.resolve(__dirname, 'node_modules/axios/dist/browser/axios.cjs'),
            type: 'sourceFile',
        };
    }
    // Fall back to default resolution for everything else
    if (defaultResolveRequest) {
        return defaultResolveRequest(context, moduleName, platform);
    }
    return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
