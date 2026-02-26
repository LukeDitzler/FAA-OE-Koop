const FaaOeProvider = require('./providers/faa-oe')

const plugins = [
  {
    instance: FaaOeProvider
  }
]

module.exports = [...plugins]