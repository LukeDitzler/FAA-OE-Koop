# FAA OE Koop Provider

A [Koop.js](https://koopjs.github.io/) provider plugin that fetches FAA Obstruction Evaluation (OE) case data from the [FAA OE/AAA public API](https://oeaaa.faa.gov), transforms the XML response into GeoJSON, and serves it as an ArcGIS-compatible Feature Service endpoint.

## What It Does

The FAA publishes data on proposed structures (towers, buildings, wind turbines, cranes, etc.) that are evaluated for their potential impact on air navigation. This project makes that data consumable as a live Feature Service that can be loaded directly into GIS applications like QGIS or ArcGIS.

**Pipeline:**
```
FAA OE/AAA API (XML) → Koop Provider → GeoJSON → ArcGIS Feature Service → QGIS / ArcGIS
```

## Tech Stack

- **Node.js** — runtime
- **Koop.js** — server framework that exposes GeoJSON as a Feature Service
- **@koopjs/output-geoservices** — Koop plugin that generates the ArcGIS REST endpoint
- **node-fetch** — fetches XML from the FAA API
- **fast-xml-parser** — parses FAA XML responses into JavaScript objects

## Project Structure

```
faa-oe-koop/
├── src/
│   ├── index.js                      # Boots the Koop server
│   └── providers/
│       └── faa-oe/
│           ├── index.js              # Registers the provider with Koop
│           ├── model.js              # Fetches FAA XML, transforms to GeoJSON
│           └── fixture.xml           # Local test data for dev (used when FAA API is unavailable)
├── config/
│   └── default.json                  # Koop app config
├── koop.json                         # Koop project metadata
└── package.json
```

## Getting Started

### Prerequisites

- Node.js v18+
- npm

### Install

```bash
git clone https://github.com/LukeDitzler/FAA-OE-Koop.git
cd FAA-OE-Koop
npm install
```

### Run (live FAA data)

```bash
node src/index.js
```

### Run (local fixture data — use when FAA API is unavailable)

```bash
FAA_USE_FIXTURE=true node src/index.js
```

The server will start at `http://localhost:8080`.

## Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /faa-oe/rest/services/FeatureServer` | Feature Service root |
| `GET /faa-oe/rest/services/FeatureServer/0` | Layer info |
| `GET /faa-oe/rest/services/FeatureServer/0/query?f=geojson` | Query all features as GeoJSON |

### Query Parameters

These are passed through to the FAA API:

| Parameter | Description | Example |
|-----------|-------------|---------|
| `year` | 4-digit year of cases (default: current year) | `year=2025` |
| `caseType` | `OE` or `NRA` (default: `OE`) | `caseType=NRA` |
| `state` | 2-letter state code filter | `state=MA` |
| `startDate` | Filter by date entered start (YYYY-MM-DD) | `startDate=2025-01-01` |
| `endDate` | Filter by date entered end (YYYY-MM-DD) | `endDate=2025-06-30` |
| `byDetermination` | Set to `true` to filter by determination date instead | `byDetermination=true` |

### Example Queries

```
# All OE cases for 2025
http://localhost:8080/faa-oe/rest/services/FeatureServer/0/query?f=geojson&year=2025

# OE cases in Massachusetts
http://localhost:8080/faa-oe/rest/services/FeatureServer/0/query?f=geojson&state=MA

# Cases determined within a date range
http://localhost:8080/faa-oe/rest/services/FeatureServer/0/query?f=geojson&byDetermination=true&startDate=2025-01-01&endDate=2025-06-30
```

## Adding to QGIS

1. In the Browser panel, right-click **ArcGIS REST Servers → New Connection**
2. Name: `FAA OE Local`, URL: `http://localhost:8080/faa-oe/rest/services/FeatureServer`
3. Expand the connection and double-click the layer to add it to the map

Or load directly as a vector layer via **Layer → Add Layer → Add Vector Layer** using the GeoJSON query URL above.

## Data Source

FAA Obstruction Evaluation / Airport Airspace Analysis (OE/AAA) public API:
- API base: `https://oeaaa.faa.gov/oeaaa/services`
- Web interface: `https://oeaaa.faa.gov`
- No authentication required for public endpoints

> **Note:** The FAA OE/AAA API is a government service and may be intermittently unavailable. Use `FAA_USE_FIXTURE=true` to run against local test data during outages.

## Feature Attributes

Each point feature includes the following attributes:

| Field | Description |
|-------|-------------|
| `asn` | Aeronautical Study Number (unique case ID) |
| `caseType` | OE or NRA |
| `dateEntered` | Date case was submitted |
| `dateCompleted` | Date FAA completed review |
| `expirationDate` | Date determination expires |
| `status` | Case status (e.g. Determined) |
| `determination` | FAA finding (e.g. "Determined Not a Hazard") |
| `nearestAirport` | ICAO code of nearest airport |
| `nearestCity` | Nearest city |
| `nearestState` | State abbreviation |
| `structureType` | Type of structure (Tower, Building, Wind Turbine, etc.) |
| `agl` | Height above ground level (ft) |
| `amslProposed` | Proposed height above mean sea level (ft) |
| `amslDetermined` | Determined height above mean sea level (ft) |
| `siteElevation` | Site elevation (ft MSL) |
| `marking` | FAA marking requirements |
| `lighting` | FAA lighting requirements |
| `sponsor` | Proponent / applicant name |
| `faaUrl` | Link to FAA case page |