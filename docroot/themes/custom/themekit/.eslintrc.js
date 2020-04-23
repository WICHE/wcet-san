// https://eslint.org/docs/user-guide/configuring

module.exports = {
  root: true,
  parserOptions: {
    parser: 'babel-eslint',
    sourceType: 'module'
  },
  env: {
    browser: true,
  },
  extends: [
    'airbnb',
  ],
  // check if imports actually resolve
  rules: {
    'no-undef': 0,              // disallow use of undeclared variables unless mentioned in a /*global */ block
    'import/no-unresolved': 0,  // disallows ensures an imported module can be resolved to a module on the local filesystem
    'func-names': 0,            // require function expressions to have a name (off by default)
    'no-new': 0,
  },
  settings: {
    'import/resolver': {
      webpack: {
        config: './webpack.config.js'
      }
    }
  }
};
