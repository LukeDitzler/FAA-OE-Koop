/**
 * faa-oe/model.js
 *
 * Fetches FAA OE case data, parses XML, returns GeoJSON FeatureCollection.
 *
 * FAA OE API base: https://oeaaa.faa.gov/oeaaa/services
 *
 * Public endpoints (no auth):
 *   By year:             /caseList/{type}/{year}?state=XX&dateEnteredStart=YYYY-MM-DD&dateEnteredEnd=YYYY-MM-DD
 *   By det. date range:  /caseList/date/{type}?start=YYYY-MM-DD&end=YYYY-MM-DD
 *   Single case by ASN:  /case/OE/{asn}
 *
 * When the FAA API is unavailable (503/shutdown), falls back to a local
 * XML fixture at src/providers/faa-oe/fixture.xml for development.
 *
 * npm dependencies: node-fetch, fast-xml-parser
 */

const fs    = require('fs')
const path  = require('path')
const fetch = require('node-fetch')
const { XMLParser } = require('fast-xml-parser')

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const FAA_BASE     = 'https://oeaaa.faa.gov/oeaaa/services'
const FIXTURE_PATH = path.join(__dirname, 'fixture.xml')
const USE_FIXTURE  = process.env.FAA_USE_FIXTURE === 'true'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseCoordinate(raw) {
  if (!raw) return null
  const str = String(raw).trim()
  if (/^-?[\d.]+$/.test(str)) return parseFloat(str)
  // DMS: e.g. "39-42-57.0000N"
  const m = str.match(/^(\d+)-(\d+)-([\d.]+)([NSEW])$/)
  if (!m) return null
  let d = parseFloat(m[1]) + parseFloat(m[2]) / 60 + parseFloat(m[3]) / 3600
  if (m[4] === 'S' || m[4] === 'W') d = -d
  return d
}

function str(v) { return (v === undefined || v === null || v === '') ? null : String(v) }
function num(v) { const n = parseFloat(v); return isNaN(n) ? null : n }

// ---------------------------------------------------------------------------
// XML Parser
// ---------------------------------------------------------------------------

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseAttributeValue: false,
  parseTagValue: false,
  // Always return arrays for these tags even when there's only one record
  isArray: (name) => ['OECase', 'NRACase', 'Case'].includes(name)
})

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

class Model {
  /**
   * req.query options:
   *   year            - 4-digit year (default: current year)
   *   caseType        - 'OE' or 'NRA' (default: 'OE')
   *   state           - 2-letter state code, e.g. 'MA' (optional)
   *   startDate       - YYYY-MM-DD (optional, maps to dateEnteredStart)
   *   endDate         - YYYY-MM-DD (optional, maps to dateEnteredEnd)
   *   byDetermination - 'true' to query by determination date instead
   */
  async getData(req) {
    const q              = req.query || {}
    const caseType       = (q.caseType || 'OE').toUpperCase()
    const year           = q.year || String(new Date().getFullYear())
    const state          = q.state || null
    const startDate      = q.startDate || null
    const endDate        = q.endDate || null
    const byDetermination = q.byDetermination === 'true'

    // ------------------------------------------------------------------
    // 1. Get XML — from fixture or FAA API
    // ------------------------------------------------------------------
    let xmlText

    if (USE_FIXTURE) {
      console.log('[faa-oe] Using local fixture (FAA_USE_FIXTURE=true)')
      xmlText = fs.readFileSync(FIXTURE_PATH, 'utf8')
    } else {
      let url
      if (byDetermination && startDate && endDate) {
        url = `${FAA_BASE}/caseList/date/${caseType}?start=${startDate}&end=${endDate}`
      } else {
        const params = new URLSearchParams()
        if (state)     params.set('state', state)
        if (startDate) params.set('dateEnteredStart', startDate)
        if (endDate)   params.set('dateEnteredEnd', endDate)
        const qs = params.toString()
        url = `${FAA_BASE}/caseList/${caseType}/${year}${qs ? '?' + qs : ''}`
      }

      console.log(`[faa-oe] Fetching: ${url}`)

      try {
        const res = await fetch(url, {
          headers: { Accept: 'application/xml, text/xml, */*' },
          timeout: 30000
        })

        if (!res.ok) {
          console.warn(`[faa-oe] FAA API returned ${res.status} — falling back to fixture`)
          xmlText = fs.readFileSync(FIXTURE_PATH, 'utf8')
        } else {
          xmlText = await res.text()
        }
      } catch (err) {
        console.warn(`[faa-oe] Fetch failed (${err.message}) — falling back to fixture`)
        xmlText = fs.readFileSync(FIXTURE_PATH, 'utf8')
      }
    }

    // ------------------------------------------------------------------
    // 2. Parse XML
    // ------------------------------------------------------------------
    let parsed
    try {
      parsed = xmlParser.parse(xmlText)
    } catch (err) {
      throw new Error(`Could not parse FAA XML: ${err.message}`)
    }

    // The root element is <caseList>, children are <OECase> or <NRACase>
    const root = parsed.caseList || parsed.CaseList || parsed
    let cases = root.OECase || root.NRACase || root.Case || []
    if (!Array.isArray(cases)) cases = cases ? [cases] : []

    console.log(`[faa-oe] Parsed ${cases.length} records`)

    // ------------------------------------------------------------------
    // 3. Transform → GeoJSON
    //    Field names come from the real FAA XML schema (confirmed via docs)
    // ------------------------------------------------------------------
    const features = []

    for (const c of cases) {
      const lat = parseCoordinate(c.latitude)
      const lon = parseCoordinate(c.longitude)
      if (lat === null || lon === null) continue

      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [lon, lat] },
        properties: {
          asn:               str(c.asn),
          caseType:          str(c.caseType),
          dateEntered:       str(c.dateEntered),
          dateCompleted:     str(c.dateCompleted),
          expirationDate:    str(c.expirationDate),
          status:            str(c.status),
          determination:     str(c.determination),
          nearestAirport:    str(c.nearestAirportName),
          nearestCity:       str(c.nearestCity),
          nearestState:      str(c.nearestState),
          structureType:     str(c.structureType),
          structureDesc:     str(c.structureDescription),
          siteElevation:     num(c.siteElevationProposed),
          agl:               num(c.aglOverallHeightProposed),
          amslProposed:      num(c.amslOverallHeightProposed),
          amslDetermined:    num(c.amslOverallHeightDet),
          marking:           str(c.marking),
          lighting:          str(c.lighting),
          sponsor:           str(c.sponsorName),
          sponsorPhone:      str(c.sponsorPhone),
          latLongAccuracy:   str(c.latLongAccuracy),
          faaUrl: c.asn
            ? `https://oeaaa.faa.gov/oeaaa/asn-display/asn-case-display-page.html?asn=${c.asn}`
            : null
        }
      })
    }

    // ------------------------------------------------------------------
    // 4. Return FeatureCollection
    // ------------------------------------------------------------------
    return {
      type: 'FeatureCollection',
      features,
      metadata: {
        name:         `FAA OE Cases — ${caseType} ${year}`,
        description:  `FAA Obstruction Evaluation ${caseType} cases`,
        geometryType: 'Point',
        idField:      'asn',
        fields: [
          { name: 'asn',             type: 'String', alias: 'Aeronautical Study Number' },
          { name: 'caseType',        type: 'String', alias: 'Case Type' },
          { name: 'dateEntered',     type: 'String', alias: 'Date Entered' },
          { name: 'dateCompleted',   type: 'String', alias: 'Date Completed' },
          { name: 'expirationDate',  type: 'String', alias: 'Expiration Date' },
          { name: 'status',          type: 'String', alias: 'Case Status' },
          { name: 'determination',   type: 'String', alias: 'FAA Determination' },
          { name: 'nearestAirport',  type: 'String', alias: 'Nearest Airport' },
          { name: 'nearestCity',     type: 'String', alias: 'Nearest City' },
          { name: 'nearestState',    type: 'String', alias: 'State' },
          { name: 'structureType',   type: 'String', alias: 'Structure Type' },
          { name: 'structureDesc',   type: 'String', alias: 'Structure Description' },
          { name: 'siteElevation',   type: 'Double', alias: 'Site Elevation (ft MSL)' },
          { name: 'agl',             type: 'Double', alias: 'Height AGL (ft)' },
          { name: 'amslProposed',    type: 'Double', alias: 'Height AMSL Proposed (ft)' },
          { name: 'amslDetermined',  type: 'Double', alias: 'Height AMSL Determined (ft)' },
          { name: 'marking',         type: 'String', alias: 'Marking Requirements' },
          { name: 'lighting',        type: 'String', alias: 'Lighting Requirements' },
          { name: 'sponsor',         type: 'String', alias: 'Sponsor / Proponent' },
          { name: 'sponsorPhone',    type: 'String', alias: 'Sponsor Phone' },
          { name: 'latLongAccuracy', type: 'String', alias: 'Lat/Long Accuracy' },
          { name: 'faaUrl',          type: 'String', alias: 'FAA Case URL' }
        ]
      }
    }
  }
}

module.exports = Model