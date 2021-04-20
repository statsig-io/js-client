const path = require('path');
const TerserPlugin = require('terser-webpack-plugin');

const BUILD_DIR = path.resolve(__dirname, './dist');
const RN_BUILD_DIR = path.resolve(__dirname, './react-native/dist');
const RN_VANILLA_BUILD_DIR = path.resolve(
  __dirname,
  './react-native-vanilla/dist',
);

const baseConfig = {
  entry: __dirname + '/index.js',
  module: {
    rules: [
      {
        test: /\.(js)$/,
        exclude: /node_modules/,
        use: 'babel-loader',
      },
    ],
  },
};

const debugOptimization = {
  optimization: {
    minimizer: [
      new TerserPlugin({
        extractComments: false,
      }),
    ],
  },
};

const prodOptimization = {
  optimization: {
    minimizer: [
      new TerserPlugin({
        extractComments: false,
        terserOptions: {
          compress: {
            drop_console: true,
          },
          format: {
            comments: false,
          },
        },
      }),
    ],
  },
};

function output(prefix) {
  return {
    output: {
      path: BUILD_DIR,
      filename: 'statsig-' + prefix + '-sdk.js',
      library: 'statsig',
      libraryTarget: 'umd',
      libraryExport: 'default',
      globalObject: 'this',
    },
  };
}

const debug = Object.assign(
  {},
  baseConfig,
  output('dev-web'),
  debugOptimization,
  {
    target: 'web',
    mode: 'development',
  },
);

const prod = Object.assign(
  {},
  baseConfig,
  output('prod-web'),
  prodOptimization,
  {
    target: 'web',
    mode: 'production',
  },
);

function reactNativeOutput(prefix) {
  return {
    output: {
      path: RN_BUILD_DIR,
      filename: (prefix ?? '') + 'statsig-react-native-sdk.js',
      library: 'statsig',
      libraryTarget: 'umd',
      libraryExport: 'default',
      globalObject: 'this',
      uniqueName: (prefix ?? '') + 'statsig-react-native-sdk',
    },
  };
}

const reactNativeDebug = Object.assign(
  {},
  baseConfig,
  reactNativeOutput('dev-'),
  {},
  {
    target: 'web',
    mode: 'development',
  },
);

const reactNativeProd = Object.assign(
  {},
  baseConfig,
  reactNativeOutput(),
  prodOptimization,
  {
    target: 'web',
    mode: 'production',
  },
);

function reactNativeVanillaOutput(prefix) {
  return {
    output: {
      path: RN_VANILLA_BUILD_DIR,
      filename: (prefix ?? '') + 'statsig-react-native-vanilla-sdk.js',
      library: 'statsig',
      libraryTarget: 'umd',
      libraryExport: 'default',
      globalObject: 'this',
      uniqueName: (prefix ?? '') + 'statsig-react-native-vanilla-sdk',
    },
  };
}

const reactNativeVanillaDebug = Object.assign(
  {},
  baseConfig,
  reactNativeVanillaOutput('dev-'),
  debugOptimization,
  {
    target: 'web',
    mode: 'development',
  },
);

const reactNativeVanillaProd = Object.assign(
  {},
  baseConfig,
  reactNativeVanillaOutput(),
  prodOptimization,
  {
    target: 'web',
    mode: 'production',
  },
);

module.exports = [
  debug,
  prod,
  reactNativeDebug,
  reactNativeProd,
  reactNativeVanillaDebug,
  reactNativeVanillaProd,
];
