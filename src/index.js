/**
 * src/index.js  —  Koop server entry point
 *
 * Run with:  node src/index.js
 * Then test: http://localhost:8080/faa-oe/FeatureServer/0/query?f=geojson
 *
 * Optional date filtering via query params (passed through to the model):
 *   ?startDate=2024-01-01&endDate=2024-03-31&caseType=OE
 */

const Koop = require('@koopjs/koop-core')
const outputGeoServices = require('@koopjs/output-geoservices')
const provider = require('./providers/faa-oe')

// ---------------------------------------------------------------------------
// Boot Koop
// ---------------------------------------------------------------------------

const koop = new Koop()

// Register the GeoServices output plugin first (gives you the FeatureServer endpoint)
koop.register(outputGeoServices)

// Register our FAA OE provider
koop.register(provider)

// ---------------------------------------------------------------------------
// Start listening
// ---------------------------------------------------------------------------

const PORT = process.env.PORT || 8080

koop.server.listen(PORT, () => {
  console.log(`
┌─────────────────────────────────────────────────────────────────┐
│  Koop FAA OE Provider is running                                │
│                                                                 │
│  FeatureServer root:                                            │
│    http://localhost:${PORT}/faa-oe/rest/services/FeatureServer                   │
│                                                                 │
│  Query all features (GeoJSON):                                  │
│    http://localhost:${PORT}/faa-oe/rest/services/FeatureServer/0/query?f=geojson │
│                                                                 │
│  Filter by date range:                                          │
│    ?startDate=2024-01-01&endDate=2024-06-30&caseType=OE        │
│                                                                 │
│  Add to ArcGIS / QGIS as a Feature Service at:                 │
│    http://localhost:${PORT}/faa-oe/FeatureServer/0               │
└─────────────────────────────────────────────────────────────────┘
  `)
})