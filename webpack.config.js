const path = require("path");

module.exports = {
  entry: "./src/index.js",
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "index.js",
    library: {
      type: "module",
    },
    environment: {
      module: true,
    },
  },
  experiments: {
    outputModule: true,
  },
  externals: {
    react: "react", // Use 'react' from the environment (do not bundle)
    "react-dom": "react-dom", // Use 'react-dom' from the environment (do not bundle)
    "react/jsx-runtime": "react/jsx-runtime", // Use host React JSX runtime
    "react/jsx-dev-runtime": "react/jsx-dev-runtime", // Use host React JSX dev runtime
  },
  module: {
    rules: [
      {
        test: /\.jsx?$/,
        exclude: /node_modules/,
        use: {
          loader: "babel-loader",
        },
      },
      {
        test: /\.css$/i,
        use: {
          loader: "css-loader",
        },
      },
    ],
  },
  resolve: {
    extensions: [".js", ".jsx"],
  },
};
