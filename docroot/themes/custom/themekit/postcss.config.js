module.exports = {
  sourceMap: true,
  parser: 'postcss-scss',
  plugins: [
    require('autoprefixer'),
    require('postcss-safe-parser')
  ]
};