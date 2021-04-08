const path = require('path');
const TerserPlugin = require('terser-webpack-plugin');

const BUILD_DIR = path.resolve(__dirname, './dist');
const RN_BUILD_DIR = path.resolve(__dirname, './react-native/lib');

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
  resolve: {
    fallback: { crypto: false },
  },
};

const prodOptimization = {
  optimization: {
    minimizer: [
      new TerserPlugin({
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

const nodeDebug = Object.assign({}, baseConfig, output('dev-node-client'), {
  target: 'node',
  mode: 'development',
});

const nodeProd = Object.assign(
  {},
  baseConfig,
  prodOptimization,
  output('prod-node-client'),
  {
    target: 'node',
    mode: 'production',
  },
);

const webDebug = Object.assign({}, baseConfig, output('dev-web'), {
  target: 'web',
  mode: 'development',
});

const webProd = Object.assign(
  {},
  baseConfig,
  output('prod-web'),
  prodOptimization,
  {
    target: 'web',
    mode: 'production',
  },
);

const reactNativeDebug = Object.assign(
  {},
  baseConfig,
  {
    output: {
      filename: 'dev-statsig-react-native-sdk.js',
      globalObject: 'this',
      library: 'statsig',
      libraryExport: 'default',
      libraryTarget: 'umd',
      path: RN_BUILD_DIR,
    },
  },
  {},
  {
    target: 'web',
    mode: 'development',
  },
);

const reactNativeProd = Object.assign(
  {},
  baseConfig,
  {
    output: {
      filename: 'statsig-react-native-sdk.js',
      globalObject: 'this',
      library: 'statsig',
      libraryExport: 'default',
      libraryTarget: 'umd',
      path: RN_BUILD_DIR,
    },
  },
  prodOptimization,
  {
    target: 'web',
    mode: 'production',
  },
);

module.exports = [
  nodeDebug,
  nodeProd,
  webDebug,
  webProd,
  reactNativeDebug,
  reactNativeProd,
];
