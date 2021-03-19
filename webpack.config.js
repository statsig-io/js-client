const path = require('path');
const TerserPlugin = require('terser-webpack-plugin');

const BUILD_DIR = path.resolve(__dirname, './dist');

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

module.exports = [nodeDebug, nodeProd, webDebug, webProd];
