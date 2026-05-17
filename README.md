# Agentic Recommendation System

Notion Worker for syncing Nipponhomes property listings into a managed Notion database and exposing a tool for fetching a user's favorite listings.

## Capabilities

### Workers

#### `nipponhomesListingsSyncV2` sync worker

Scheduled replace sync that writes Nipponhomes listing data into the managed `nipponhomesListingsV2` database.

- Schedule: every `24h`
- Mode: `replace`
- Page size: `100`
- Rate limit: `5` Nipponhomes API requests per second via the `nipponhomesApi` pacer
- Source endpoints:
  - `/api/listings/latest-scraped`
  - `/api/listings/price-drops`

The sync paginates each endpoint with `limit` and `offset`, then moves to the next endpoint when the current one is exhausted. Each Notion row uses a sync key in the form:

```text
{category}:{listing_id}
```

This keeps the same listing distinct when it appears in multiple categories such as `new_listing` and `price_drop`.

### Tools

#### `getNipponhomesFavorites`

Tool that fetches up to 50 favorite listings for a Nipponhomes user by UUID.

Input:

```json
{
	"userUuid": "USER_UUID"
}
```

It calls:

```text
/api/listings/favorites/{userUuid}?limit=50
```

## Synced Database

The worker creates a managed Notion database named `Nipponhomes Listings` with primary key property `Sync Key`.

Synced properties:

| Property | Type | Source |
| --- | --- | --- |
| `Title` | title | `title_english`, `title`, or fallback listing id |
| `Sync Key` | rich text | `{category}:{listing_id}` |
| `Listing ID` | rich text | `listing_id` |
| `Category` | select | `new_listing`, `price_drop`, or `favorite` |
| `Listing URL` | URL | `listing_url` |
| `Price` | number, yen | `price` |
| `Previous Price` | number, yen | `previous_price` |
| `Change Amount` | number, yen | `change_amount` |
| `Price USD` | number, dollar | `price_usd` |
| `Previous Price USD` | number, dollar | `previous_price_usd` |
| `Change Amount USD` | number, dollar | `change_amount_usd` |
| `Change Percentage` | number, percent | `change_percentage` |
| `Location` | rich text | `location` |
| `Location English` | rich text | `location_english` |
| `City` | rich text | `city_en` |
| `Prefecture` | rich text | `prefecture_en` |
| `Listing Type` | rich text | `listing_type_en` or `listing_type` |
| `Rooms` | rich text | `rooms_normalized` or `rooms` |
| `Latitude` | number | `lat` |
| `Longitude` | number | `lng` |
| `Price Changed At` | date | `price_changed_at` |
| `First Seen` | date | `first_seen` |
| `Last Seen` | date | `last_seen` |
| `Primary Image` | URL | first image URL |
| `Pictures` | file | all image URLs |
| `Image Count` | number | number of image URLs |
| `S3 Key` | rich text | `s3_key` |

The sync also sets the page icon to the first listing image when available and writes page markdown with category, source URL, event/saved metadata, notes, tags, price details, location, and image links.

## Configuration

Create a local `.env` file for local execution:

```shell
NIPPONHOMES_API_KEY=your-api-key
NIPPONHOMES_API_BASE_URL=https://nipponhomes.com
```

`NIPPONHOMES_API_KEY` is required. `NIPPONHOMES_API_BASE_URL` is optional and defaults to `https://nipponhomes.com`.

For deployed workers, push the same environment variables to Notion:

```shell
ntn workers env push
```

## Development

Requirements:

- Node `>=22.0.0`
- npm `>=10.9.2`

Install dependencies:

```shell
npm install
```

Type-check:

```shell
npm run check
```

Build:

```shell
npm run build
```

## Local Execution

Preview the listings sync without writing to Notion:

```shell
ntn workers sync trigger nipponhomesListingsSyncV2 --preview --local
```

Preview the next sync page with a returned context:

```shell
ntn workers sync trigger nipponhomesListingsSyncV2 --preview --local --context '{"endpointIndex":0,"offset":100}'
```

Run the favorites tool locally:

```shell
ntn workers exec getNipponhomesFavorites --local -d '{"userUuid":"USER_UUID"}'
```

## Deployment

Deploy the worker:

```shell
ntn workers deploy
```

Check sync health:

```shell
ntn workers sync status nipponhomesListingsSyncV2
```

Trigger a real sync immediately:

```shell
ntn workers sync trigger nipponhomesListingsSyncV2
```

Reset sync state before a full re-run:

```shell
ntn workers sync state reset nipponhomesListingsSyncV2
```

## Project Structure

- `src/index.ts` defines the worker, database, sync, tools, API client, and mapping helpers.
- `.agents/skills/` contains shared agent workflow skills for sync creation, debugging, and validation.
- `dist/` contains compiled JavaScript after `npm run build`.
- `workers.json` contains Notion Workers CLI configuration.
