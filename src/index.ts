import { Worker } from "@notionhq/workers";
import * as Builder from "@notionhq/workers/builder";
import * as Schema from "@notionhq/workers/schema";
import { j } from "@notionhq/workers/schema-builder";
import type { TextValue } from "@notionhq/workers/types";

const worker = new Worker();
export default worker;

const NIPPONHOMES_API_BASE_URL =
	process.env.NIPPONHOMES_API_BASE_URL ?? "https://nipponhomes.com";
const NIPPONHOMES_LISTINGS_LIMIT = 100;

type ListingCategory = "new_listing" | "price_drop" | "favorite";

type ListingsState = {
	endpointIndex: number;
	offset: number;
};

type NipponhomesListing = {
	listing_id: string;
	category?: ListingCategory | string | null;
	title?: string | null;
	price?: string | number | null;
	previous_price?: string | number | null;
	change_amount?: string | number | null;
	price_usd?: number | null;
	previous_price_usd?: number | null;
	change_amount_usd?: number | null;
	change_percentage?: string | number | null;
	event_at?: string | null;
	saved_at?: string | null;
	notes?: string | null;
	tags?: string | null;
	price_changed_at?: string | null;
	first_seen?: string | null;
	scraped_at?: string | null;
	last_seen?: string | null;
	location?: string | null;
	location_english?: string | null;
	city_en?: string | null;
	prefecture_en?: string | null;
	title_english?: string | null;
	listing_type?: string | null;
	listing_type_en?: string | null;
	listing_url?: string | null;
	lat?: number | string | null;
	lng?: number | string | null;
	rooms?: string | null;
	rooms_normalized?: string | null;
	s3_bucket_name?: string | null;
	s3_key?: string | null;
	images?: Array<string | { cloudfrontUrl?: string; sourceUrl?: string }> | null;
	imageLinks?: string[] | null;
};

type NipponhomesListingsResponse = {
	listings?: NipponhomesListing[];
	hasMore?: boolean;
	meta?: {
		offset?: number;
		limit?: number;
		generatedAt?: string;
	};
};

type NipponhomesComparablesGuidanceResponse = {
	listing: {
		listing_id: string;
		title: string | null;
		listing_type: string | null;
		listing_type_en: string | null;
		price_jpy: number;
		price: number;
		currency: string;
		effective_size_sqm: number;
		effective_size_sqft: number;
		price_per_sqft_jpy: number;
		price_per_sqft: number;
	};
	comparables: Array<{
		radius_km: 1 | 2;
		count: number;
		active_count: number;
		avg_price_per_sqft: number | null;
		median_price_per_sqft: number | null;
		min_price_per_sqft: number | null;
		max_price_per_sqft: number | null;
	}>;
};

const listingEndpoints: Array<{
	category: ListingCategory;
	path: string;
}> = [
	{ category: "new_listing", path: "/api/listings/latest-scraped" },
	{ category: "price_drop", path: "/api/listings/price-drops" },
];

const nipponhomesListings = worker.database("nipponhomesListingsV2", {
	type: "managed",
	initialTitle: "Nipponhomes Listings",
	primaryKeyProperty: "Sync Key",
	schema: {
		properties: {
			"Title": Schema.title(),
			"Sync Key": Schema.richText(),
			"Listing ID": Schema.richText(),
			"Category": Schema.select([
				{ name: "new_listing", color: "green" },
				{ name: "price_drop", color: "red" },
				{ name: "favorite", color: "yellow" },
			]),
			"Listing URL": Schema.url(),
			"Price": Schema.number("yen"),
			"Previous Price": Schema.number("yen"),
			"Change Amount": Schema.number("yen"),
			"Price USD": Schema.number("dollar"),
			"Previous Price USD": Schema.number("dollar"),
			"Change Amount USD": Schema.number("dollar"),
			"Change Percentage": Schema.number("percent"),
			"Location": Schema.richText(),
			"Location English": Schema.richText(),
			"City": Schema.richText(),
			"Prefecture": Schema.richText(),
			"Listing Type": Schema.richText(),
			"Rooms": Schema.richText(),
			"Latitude": Schema.number(),
			"Longitude": Schema.number(),
			"Price Changed At": Schema.date(),
			"First Seen": Schema.date(),
			"Last Seen": Schema.date(),
			"Primary Image": Schema.url(),
			"Pictures": Schema.file(),
			"Image Count": Schema.number(),
			"S3 Key": Schema.richText(),
		},
	},
});

const nipponhomesApi = worker.pacer("nipponhomesApi", {
	allowedRequests: 5,
	intervalMs: 1000,
});

worker.sync("nipponhomesListingsSyncV2", {
	database: nipponhomesListings,
	mode: "replace",
	schedule: "24h",
	execute: async (state: ListingsState | undefined) => {
		const endpointIndex = state?.endpointIndex ?? 0;
		const endpoint = listingEndpoints[endpointIndex] ?? listingEndpoints[0];
		const offset = state?.offset ?? 0;

		const response = await fetchNipponhomesListings(
			endpoint.path,
			offset,
			NIPPONHOMES_LISTINGS_LIMIT,
		);
		const listings = (response.listings ?? []).map((listing) => ({
			...listing,
			category: listing.category ?? endpoint.category,
		}));
		const hasMoreForEndpoint = Boolean(response.hasMore);
		const hasNextEndpoint = endpointIndex < listingEndpoints.length - 1;
		const nextOffset = offset + (response.meta?.limit ?? NIPPONHOMES_LISTINGS_LIMIT);

		return {
			changes: listings.map((listing) => ({
				type: "upsert" as const,
				key: listingKey(listing),
				properties: toListingProperties(listing),
				upstreamUpdatedAt:
					normalizeDateTime(listing.price_changed_at) ??
					normalizeDateTime(listing.last_seen) ??
					normalizeDateTime(listing.scraped_at) ??
					response.meta?.generatedAt,
				icon: primaryImageUrl(listing)
					? Builder.imageIcon(primaryImageUrl(listing)!)
					: undefined,
				pageContentMarkdown: listingPageContent(listing),
			})),
			hasMore: hasMoreForEndpoint || hasNextEndpoint,
			nextState: hasMoreForEndpoint
				? { endpointIndex, offset: nextOffset }
				: hasNextEndpoint
					? { endpointIndex: endpointIndex + 1, offset: 0 }
					: undefined,
		};
	},
});

worker.tool("getNipponhomesFavorites", {
	title: "Get Nipponhomes Favorites",
	description:
		"Fetch the latest favorite listings for a Nipponhomes user from the partner API.",
	schema: j.object({
		userUuid: j
			.string()
			.describe("The Nipponhomes user UUID to fetch favorite listings for."),
	}),
	execute: async ({ userUuid }) => fetchNipponhomesFavorites(userUuid, 50),
});

worker.tool("getNipponhomesComparablesGuidance", {
	title: "Get Nipponhomes Comparables Guidance",
	description:
		"Fetch price per square foot guidance for a listing, including nearby comparable summaries within 1 km and 2 km.",
	schema: j.object({
		listingId: j
			.string()
			.describe("The Nipponhomes listing ID to analyze, for example 20825920."),
		currency: j
			.string()
			.describe("Currency code for converted values. Defaults to USD.")
			.nullable(),
	}),
	execute: async ({ listingId, currency }) =>
		fetchNipponhomesComparablesGuidance(listingId, currency ?? "USD"),
});

async function fetchNipponhomesListings(
	path: string,
	offset: number,
	limit: number,
): Promise<NipponhomesListingsResponse> {
	const url = new URL(path, NIPPONHOMES_API_BASE_URL);
	url.searchParams.set("limit", limit.toString());
	url.searchParams.set("offset", offset.toString());

	return fetchNipponhomesApi(url, { waitForPacer: true });
}

async function fetchNipponhomesFavorites(
	userUuid: string,
	limit: number,
): Promise<NipponhomesListingsResponse> {
	const url = new URL(
		`/api/listings/favorites/${encodeURIComponent(userUuid)}`,
		NIPPONHOMES_API_BASE_URL,
	);
	url.searchParams.set("limit", limit.toString());

	return fetchNipponhomesApi(url);
}

async function fetchNipponhomesComparablesGuidance(
	listingId: string,
	currency: string,
): Promise<NipponhomesComparablesGuidanceResponse> {
	const url = new URL(
		`/api/listings/${encodeURIComponent(listingId)}/price-per-sqft`,
		NIPPONHOMES_API_BASE_URL,
	);
	url.searchParams.set("currency", currency);

	return fetchNipponhomesApi(url);
}

async function fetchNipponhomesApi<TResponse = NipponhomesListingsResponse>(
	url: URL,
	options: { waitForPacer?: boolean } = {},
): Promise<TResponse> {
	const apiKey = process.env.NIPPONHOMES_API_KEY;
	if (!apiKey) {
		throw new Error("NIPPONHOMES_API_KEY must be set");
	}

	if (options.waitForPacer) {
		await nipponhomesApi.wait();
	}
	const response = await fetch(url, {
		headers: {
			"x-api-key": apiKey,
		},
	});

	if (!response.ok) {
		throw new Error(
			`Nipponhomes listings request failed with ${response.status}: ${await response.text()}`,
		);
	}

	return (await response.json()) as TResponse;
}

function toListingProperties(listing: NipponhomesListing) {
	const images = imageUrls(listing);
	const category = listingCategory(listing);

	return {
		"Title": Builder.title(
			stringValue(listing.title_english) ??
				stringValue(listing.title) ??
				`Listing ${listing.listing_id}`,
		),
		"Sync Key": Builder.richText(listingKey(listing)),
		"Listing ID": Builder.richText(listing.listing_id),
		"Category": Builder.select(category),
		"Listing URL": urlValue(listing.listing_url),
		"Price": numberValue(listing.price),
		"Previous Price": numberValue(listing.previous_price),
		"Change Amount": numberValue(listing.change_amount),
		"Price USD": numberValue(listing.price_usd),
		"Previous Price USD": numberValue(listing.previous_price_usd),
		"Change Amount USD": numberValue(listing.change_amount_usd),
		"Change Percentage": percentValue(listing.change_percentage),
		"Location": textValue(listing.location),
		"Location English": textValue(listing.location_english),
		"City": textValue(listing.city_en),
		"Prefecture": textValue(listing.prefecture_en),
		"Listing Type": textValue(listing.listing_type_en ?? listing.listing_type),
		"Rooms": textValue(listing.rooms_normalized ?? listing.rooms),
		"Latitude": numberValue(listing.lat),
		"Longitude": numberValue(listing.lng),
		"Price Changed At": dateTimeValue(listing.price_changed_at),
		"First Seen": dateTimeValue(listing.first_seen),
		"Last Seen": dateTimeValue(listing.last_seen),
		"Primary Image": urlValue(images[0]),
		"Pictures": imageFileValues(images, listing),
		"Image Count": Builder.number(images.length),
		"S3 Key": textValue(listing.s3_key),
	};
}

function listingPageContent(listing: NipponhomesListing): string {
	const images = imageUrls(listing);
	const lines = [
		`Category: ${listingCategory(listing)}`,
		`Source: ${stringValue(listing.listing_url) ?? "N/A"}`,
		`Event at: ${stringValue(listing.event_at) ?? "N/A"}`,
		`Saved at: ${stringValue(listing.saved_at) ?? "N/A"}`,
		`Notes: ${stringValue(listing.notes) ?? "N/A"}`,
		`Tags: ${stringValue(listing.tags) ?? "N/A"}`,
		`Price: ${stringValue(listing.price) ?? "N/A"}`,
		`Previous price: ${stringValue(listing.previous_price) ?? "N/A"}`,
		`Price USD: ${stringValue(listing.price_usd) ?? "N/A"}`,
		`Previous price USD: ${stringValue(listing.previous_price_usd) ?? "N/A"}`,
		`Change amount USD: ${stringValue(listing.change_amount_usd) ?? "N/A"}`,
		`Change: ${stringValue(listing.change_amount) ?? "N/A"} (${stringValue(listing.change_percentage) ?? "N/A"}%)`,
		`Location: ${stringValue(listing.location_english) ?? stringValue(listing.location) ?? "N/A"}`,
	];

	if (images.length > 0) {
		lines.push("", "## Images", ...images.map((image) => `- ${image}`));
	}

	return lines.join("\n");
}

function listingKey(listing: NipponhomesListing): string {
	return `${listingCategory(listing)}:${listing.listing_id}`;
}

function listingCategory(listing: NipponhomesListing): ListingCategory {
	if (listing.category === "price_drop") {
		return "price_drop";
	}

	if (listing.category === "favorite") {
		return "favorite";
	}

	return "new_listing";
}

function imageUrls(listing: NipponhomesListing): string[] {
	const images = listing.images ?? listing.imageLinks ?? [];

	return images
		.map((image) => {
			if (typeof image === "string") {
				return image;
			}

			return image.cloudfrontUrl ?? image.sourceUrl;
		})
		.filter((image): image is string => Boolean(image));
}

function primaryImageUrl(listing: NipponhomesListing): string | undefined {
	return imageUrls(listing)[0];
}

function imageFileValues(
	images: string[],
	listing: NipponhomesListing,
): TextValue {
	return images.flatMap((image, index) =>
		Builder.file(image, imageFileName(listing, index)),
	);
}

function imageFileName(listing: NipponhomesListing, index: number): string {
	return `${listing.listing_id}-image-${index + 1}`;
}

function stringValue(value: unknown): string | undefined {
	if (value === null || value === undefined) {
		return undefined;
	}

	const stringified = String(value).trim();
	return stringified.length > 0 ? stringified : undefined;
}

function textValue(value: unknown): TextValue {
	const text = stringValue(value);
	return text ? Builder.richText(text) : [];
}

function urlValue(value: unknown): TextValue {
	const url = stringValue(value);
	return url ? Builder.url(url) : [];
}

function numberValue(value: unknown): TextValue {
	const numeric = numericValue(value);
	return Builder.number(numeric);
}

function percentValue(value: unknown): TextValue {
	const numeric = numericValue(value);
	return Builder.number(Number.isNaN(numeric) ? numeric : numeric / 100);
}

function numericValue(value: unknown): number {
	const raw = stringValue(value);
	if (!raw) {
		return Number.NaN;
	}

	return Number(raw.replace(/[$¥,\s]/g, ""));
}

function dateTimeValue(value: unknown): TextValue {
	const isoDateTime = normalizeDateTime(value);
	return isoDateTime ? Builder.dateTime(isoDateTime) : [];
}

function normalizeDateTime(value: unknown): string | undefined {
	const raw = stringValue(value);
	if (!raw) {
		return undefined;
	}

	const normalized = raw.includes("T") ? raw : raw.replace(" ", "T");
	const withMilliseconds = normalized.replace(
		/(\.\d{3})\d+/,
		(_match, milliseconds: string) => milliseconds,
	);
	const withTimezone = /(?:Z|[+-]\d{2}:\d{2})$/.test(withMilliseconds)
		? withMilliseconds
		: `${withMilliseconds}Z`;

	return Number.isNaN(Date.parse(withTimezone)) ? undefined : withTimezone;
}
