const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const METADATA_RE = new RegExp(`/metadata/(${UUID})$`, 'i');
const PROOF_RE = new RegExp(`/proofs/(${UUID})$`, 'i');

/** Extracts our metadata id from a URI stored on chain, if it points at this API. */
export function metadataIdFromUri(uri: string): string | null {
  return METADATA_RE.exec(uri)?.[1]?.toLowerCase() ?? null;
}

export function proofIdFromUri(uri: string): string | null {
  return PROOF_RE.exec(uri)?.[1]?.toLowerCase() ?? null;
}
