/**
 * Version constants that participate in determinism.
 *
 * Any change to the Fact shape bumps {@link FACT_SCHEMA_VERSION}. Any change to a
 * normalization algorithm bumps {@link NORMALIZER_VERSION} and is treated as a
 * migration (full re-extract). Both are folded into the snapshot header and the
 * run cache key, so a bump invalidates caches.
 */

/** Version of the Fact envelope + kind catalog. */
export const FACT_SCHEMA_VERSION = '0.2.0' as const;

/** Version of the shared, versioned normalization algorithms. */
export const NORMALIZER_VERSION = '0.2.0' as const;
