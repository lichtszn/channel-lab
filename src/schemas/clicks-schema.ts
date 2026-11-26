import type { CollectionSchema, RolePermissions } from 'deepspace/schema'

export type Click = {
  variant: string
  experimentId: string
  /** The experiment owner's user id (never the visitor's), set by the click route. */
  ownerId: string
  clickedAt: string
}

/** Each signed-in user can read the clicks on their own experiments, and nothing else. */
const readOwnClicks: RolePermissions = { read: 'own', create: false, update: false, delete: false }
const noAccess: RolePermissions = { read: false, create: false, update: false, delete: false }

/**
 * One row per counted click, written only by the worker's /go/:slug route.
 * It stores which variant and experiment, whose experiment it is, and when.
 * Nothing about the visitor: no IP address or other visitor data.
 *
 * `ownerId` is NOT userBound: no client can create clicks, and the server sets
 * it to the experiment owner (the docs' schema-lint rule for server-written rows).
 * Rows written before 2026-11-25's Prompt 6 have no experimentId or ownerId.
 */
export const clicksSchema: CollectionSchema = {
  name: 'clicks',
  columns: [
    { name: 'variant', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    { name: 'experimentId', storage: 'text', interpretation: 'plain', immutable: true },
    { name: 'ownerId', storage: 'text', interpretation: 'plain', immutable: true },
    {
      name: 'clickedAt',
      storage: 'text',
      interpretation: { kind: 'datetime' },
      required: true,
      immutable: true,
    },
  ],
  ownerField: 'ownerId',
  permissions: {
    '*': noAccess,
    viewer: noAccess,
    member: readOwnClicks,
    admin: readOwnClicks,
  },
}
