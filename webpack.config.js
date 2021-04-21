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

const debug = Object.assign({}, baseConfig, output('dev-web'), {
  target: 'web',
  mode: 'development',
  optimization: {
    minimizer: [
      new TerserPlugin({
        extractComments: false,
      }),
    ],
  },
});

const prod = Object.assign({}, baseConfig, output('prod-web'), {
  target: 'web',
  mode: 'production',
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
});

module.exports = [debug, prod];
