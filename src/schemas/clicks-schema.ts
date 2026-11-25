import type { CollectionSchema } from 'deepspace/schema'

/**
 * One row per counted click. Only the worker's /go/:slug route writes here, and
 * it stores the variant and the time only: no IP address or other visitor data.
 */
export const clicksSchema: CollectionSchema = {
  name: 'clicks',
  columns: [
    { name: 'variant', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    {
      name: 'clickedAt',
      storage: 'text',
      interpretation: { kind: 'datetime' },
      required: true,
      immutable: true,
    },
  ],
  permissions: {
    '*': { read: false, create: false, update: false, delete: false },
    viewer: { read: false, create: false, update: false, delete: false },
    member: { read: false, create: false, update: false, delete: false },
    admin: { read: true, create: false, update: false, delete: false },
  },
}
