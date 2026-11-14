import type { PublishedRelease, PublishedReleaseAsset } from '../domain/release';

/**
 * Data Mapper: GitHub's "get the latest release" JSON → `PublishedRelease` (S05-07). Checks only
 * the shape the app reads (`tag_name`, `assets[].name`, `assets[].browser_download_url`,
 * `assets[].size`); validating the content is the domain's job (`parseRelease`).
 * Returns `undefined` for a body of the wrong shape.
 */

type JsonObject = Readonly<Record<string, unknown>>;

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** A missing or null size becomes `null`; any other non-number is a malformed body. */
function toSize(size: unknown): number | null | undefined {
  if (size === undefined || size === null) return null;
  return typeof size === 'number' ? size : undefined;
}

function toAsset(json: unknown): PublishedReleaseAsset | undefined {
  if (!isJsonObject(json)) return undefined;
  const { name, browser_download_url: downloadUrl } = json;
  const sizeBytes = toSize(json.size);
  return typeof name === 'string' && typeof downloadUrl === 'string' && sizeBytes !== undefined
    ? Object.freeze({ name, downloadUrl, sizeBytes })
    : undefined;
}

function toAssets(json: unknown): readonly PublishedReleaseAsset[] | undefined {
  if (!Array.isArray(json)) return undefined;
  const assets = json.map(toAsset);
  return assets.every((asset) => asset !== undefined) ? Object.freeze(assets) : undefined;
}

export function toPublishedRelease(json: unknown): PublishedRelease | undefined {
  if (!isJsonObject(json) || typeof json.tag_name !== 'string') return undefined;
  const assets = toAssets(json.assets);
  return assets === undefined ? undefined : Object.freeze({ tagName: json.tag_name, assets });
}
