const merge = require("merge");
const tmp = require("tmp");
const fs = require("fs");
const path = require("path");

const MODULES = path.join(__dirname, "..", "node_modules");

module.exports = {
  defaultConfig(config) {
    // For some reason, eslint.CLIEngine doesn't support "extends",
    // it has to be done through a configuration file
    const esConfig = tmp.fileSync({
      prefix: "crafty-config-",
      postfix: ".json"
    }).name;

    fs.writeFileSync(
      esConfig,
      JSON.stringify({ extends: ["plugin:@swissquote/swissquote/recommended"] })
    );

    return {
      // In case of browser support changes, we prefer having a fixed version
      eslintReactVersion: "15.0",

      // ESLint Override Rules
      eslint: {
        useEslintrc: false,
        plugins: ["@swissquote/swissquote"],
        configFile: esConfig
      }
    }
  },
  config(config) {
    // Add eslint react version
    config.eslint = merge.recursive(config.eslint, {
      baseConfig: {
        settings: { react: { version: config.eslintReactVersion } }
      }
    });

    return config;
  },
  ide() {
    const configurationBuilder = require("./eslintConfigurator");

    return {
      ".eslintrc.js": {
        content: configurationBuilder(process.argv).configuration,
        serializer: content => `// This configuration was generated by Crafty
// This file is generated to improve IDE Integration
// You don't need to commit this file, nor need it to run \`crafty build\`

module.exports = ${JSON.stringify(content, null, 4)};
`
      }
    };
  },
  commands() {
    return {
      jsLint: {
        //eslint-disable-next-line no-unused-vars
        command: function(crafty, input, cli) {
          global.craftyConfig = crafty.config;
          require("./commands/jsLint");
        },
        description: "Lint JavaScript for errors"
      }
    };
  },
  rollup(crafty, bundle, rollupConfig) {
    // Add Eslint configuration
    //TODO :: throw error after all files are linted, not after first error
    rollupConfig.input.plugins.eslint = {
      plugin: require("rollup-plugin-eslint").eslint,
      weight: -20,
      options: Object.assign({}, crafty.config.eslint, {
        throwOnError: crafty.getEnvironment() === "production",
        exclude: ["node_modules/**"],
        include: ["**/*.js", "**/*.jsx"]
      })
    };
  },
  webpack(crafty, bundle, chain) {
    chain.resolve.extensions.add(".jsx");
    chain.resolve.modules.add(MODULES);
    chain.resolveLoader.modules.add(MODULES);

    // JavaScript linting
    chain.module
      .rule("lint-js")
      .pre()
      .test(/\.jsx?$/)
      .exclude.add(/(node_modules|bower_components)/)
      .end()
      .use("eslint")
      .loader(require.resolve("eslint-loader"))
      .options(crafty.config.eslint);
  }
}