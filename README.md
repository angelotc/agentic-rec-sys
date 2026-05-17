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

Verified example user UUID:

```text
0e95e453-e4af-43c4-a692-617e2f826d3c
```

The API returned `HTTP 200` for this user with 8 favorite listings, `hasMore: false`, and `meta.category: "favorite"`. The response includes listing fields such as `listing_id`, `category`, `event_at`, `saved_at`, `notes`, `tags`, `title`, `price`, `price_usd`, location fields, listing type fields, `listing_url`, coordinates, S3 metadata, and generated CloudFront image URLs.

Abbreviated response shape from the verified call:

```json
{
	"listings": [
		{
			"listing_id": "01463880002800",
			"category": "favorite",
			"event_at": "2026-05-16 20:33:39.609537",
			"saved_at": "2026-05-16 20:33:39.609537",
			"title_english": "Daigo Minamihata Yamacho, Fushimi Ward",
			"price": "17800000.00",
			"price_usd": 112164.53,
			"location_english": "Daigo Minamihata Yamacho, Fushimi Ward, Kyoto City, Kyoto Prefecture",
			"listing_type_en": "Used Detached House",
			"listing_url": "https://myhome.nifty.com/chuko-ikkodate/kyoto/kyotoshifushimiku_ct/homesf_01463880002800/",
			"lat": 34.940594,
			"lng": 135.81966,
			"s3_bucket_name": "listings-pictures333221",
			"s3_key": "01463880002800/34abd40e25bcb08f2394b7a1cbf9c7c1.php",
			"images": ["https://d26mcwbu6amef4.cloudfront.net/..."],
			"...": "additional listing metadata omitted"
		},
		{
			"listing_id": "01523210000449",
			"category": "favorite",
			"event_at": "2026-05-16 20:33:37.767086",
			"saved_at": "2026-05-16 20:33:37.767086",
			"title_english": "Used Detached House Motomiya 2",
			"price": "34800000.00",
			"price_usd": 219287.96,
			"image_count": 30,
			"...": "additional listing metadata omitted"
		}
	],
	"hasMore": false,
	"meta": {
		"category": "favorite",
		"userUuid": "0e95e453-e4af-43c4-a692-617e2f826d3c",
		"usdRate": 158.695446,
		"limit": 50,
		"offset": 0,
		"generatedAt": "2026-05-17T18:53:29.943Z"
	}
}
```

#### `getNipponhomesComparablesGuidance`

Tool that fetches price-per-square-foot guidance for a listing, including nearby comparable summaries within 1 km and 2 km.

Input:

```json
{
	"listingId": "LISTING_ID",
	"currency": "USD"
}
```

`currency` is nullable in the tool input and defaults to `USD`.

It calls the price-per-square-foot guidance endpoint used in `src/index.ts`:

```text
/api/listings/{listingId}/price-per-sqft?currency=USD
```

Verified example listing ID:

```text
20865820
```

The API returned `HTTP 200` for this listing. The listing was priced at `$408.17/sq ft`, while the 1 km comparable median was `$235.49/sq ft` and the 2 km comparable median was `$224.40/sq ft`.

Abbreviated response shape from the verified call:

```json
{
	"listing": {
		"listing_id": "20865820",
		"title": "【SUUMO】海老江８（淀川駅） | 中古住宅・中古一戸建て物件情報",
		"listing_type_en": "Used Detached House",
		"price_jpy": 68900000,
		"price": 434164.95,
		"currency": "USD",
		"effective_size_sqm": 98.82,
		"effective_size_sqft": 1063.7,
		"price_per_sqft_jpy": 64773.99,
		"price_per_sqft": 408.17
	},
	"comparables": [
		{
			"radius_km": 1,
			"count": 180,
			"active_count": 26,
			"avg_price_per_sqft": 235.34,
			"median_price_per_sqft": 235.49,
			"min_price_per_sqft": 41.41,
			"max_price_per_sqft": 607.49,
			"pricing_guidance": {
				"status": "above_market",
				"benchmark": "median",
				"benchmark_price_per_sqft": 235.49,
				"premium_percent": 73.3,
				"suggested_lowball_percent": 42.3,
				"message": "This listing is above the 1 km comparable median; you can lowball up to 42.3% to match local comps."
			}
		},
		{
			"radius_km": 2,
			"count": 868,
			"active_count": 141,
			"avg_price_per_sqft": 260.25,
			"median_price_per_sqft": 224.4,
			"min_price_per_sqft": 9.74,
			"max_price_per_sqft": 1343.02,
			"pricing_guidance": {
				"status": "above_market",
				"benchmark": "median",
				"benchmark_price_per_sqft": 224.4,
				"premium_percent": 81.9,
				"suggested_lowball_percent": 45,
				"message": "This listing is above the 2 km comparable median; you can lowball up to 45% to match local comps."
			}
		}
	],
	"meta": {
		"currency": "USD",
		"jpyRate": 158.695446,
		"radiiKm": [1, 2],
		"sampleCount": 868,
		"searchStrategy": "lat_lng_bounding_box_with_exact_distance",
		"generatedAt": "2026-05-17T18:52:07.594Z"
	}
}
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

Run the verified favorites example locally:

```shell
ntn workers exec getNipponhomesFavorites --local -d '{"userUuid":"0e95e453-e4af-43c4-a692-617e2f826d3c"}'
```

Run the comparables guidance tool locally:

```shell
ntn workers exec getNipponhomesComparablesGuidance --local -d '{"listingId":"LISTING_ID","currency":"USD"}'
```

Run the verified comparables guidance example locally:

```shell
ntn workers exec getNipponhomesComparablesGuidance --local -d '{"listingId":"20865820","currency":"USD"}'
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
