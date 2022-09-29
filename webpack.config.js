const path = require('path');
const TerserPlugin = require('terser-webpack-plugin');

module.exports = {
  entry: './src/index.ts',
  mode: 'production',
  target: 'web',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
  },
  output: {
    filename: 'statsig-prod-web-sdk.js',
    library: {
        type: 'umd',
        name: {
            root: 'statsig',
            amd: 'statsig',
            commonjs: 'statsig',
        }
    },
    path: path.resolve(__dirname, 'build'),
    libraryExport: 'default',
    globalObject: 'this',
  },
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
