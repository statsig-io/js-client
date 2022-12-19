const path = require('path');
const TerserPlugin = require('terser-webpack-plugin');
const CircularDependencyPlugin = require('circular-dependency-plugin');

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
      },
    },
    path: path.resolve(__dirname, 'build'),
    libraryExport: 'default',
    globalObject: 'this',
  },
  plugins: [
    new CircularDependencyPlugin({
      onDetected({ module: _webpackModuleRecord, paths, compilation }) {
        compilation.errors.push(new Error(paths.join(' -> ')));
      },
      exclude: /node_modules/,
      include: /src/,
      failOnError: true,
      allowAsyncCycles: false,
      cwd: process.cwd(),
    }),
  ],
  optimization: {
    minimizer: [
      new TerserPlugin({
        extractComments: false,
        terserOptions: {
          compress: {
            drop_console: false,
          },
          format: {
            comments: false,
          },
        },
      }),
    ],
  },
};
