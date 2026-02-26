/**
 * faa-oe/index.js
 *
 * Koop provider registration object for the FAA Obstruction Evaluation (OE) data source.
 */

const Model = require('./model')

module.exports = {
  type: 'provider',
  name: 'faa-oe',
  version: '0.0.1',
  Model,
  hosts: false,
  disableIdParam: true
}