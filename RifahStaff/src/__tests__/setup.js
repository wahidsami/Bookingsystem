const Module = require('module');
const originalRequire = Module.prototype.require;

Module.prototype.require = function (id) {
    if (id === 'react-native') {
        return {
            Platform: {
                OS: 'ios',
                select: (obj) => obj.default || obj.ios || {},
            },
            StyleSheet: {
                create: (styles) => styles,
                hairlineWidth: 1,
                absoluteFillObject: {},
            },
            Alert: {
                alert: () => {},
            },
        };
    }
    return originalRequire.apply(this, arguments);
};
