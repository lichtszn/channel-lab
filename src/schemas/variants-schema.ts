import type { CollectionSchema, RolePermissions } from 'deepspace/schema'
import { noAccess, ownerColumn } from './experiments-schema'

export type Variant = {
  experimentId: string
  channelName: string
  slug: string
  outcomeCount: number
  outcomeLabel: string
  /** People who could see this channel; entered by hand. Absent until entered. */
  reach?: number | null
  /** Set by the server to the creator's user id; clients cannot choose it. */
  ownerId?: string
}

/** The UI allows 2 to 4 variants per experiment. The server does not enforce this. */
export const MIN_VARIANTS = 2
export const MAX_VARIANTS = 4

/** Slugs the click route accepts. Generated slugs are 8 of these characters. */
export const SLUG_PATTERN = /^[a-z0-9]{8}$/
const SLUG_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'

export function newSlug(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8))
  return Array.from(bytes, (b) => SLUG_ALPHABET[b % SLUG_ALPHABET.length]).join('')
}

/**
 * Channels: signed-in users create, read and edit only their own. Deleting goes
 * through the deleteChannel server action, which refuses channels with clicks.
 */
const ownVariants: RolePermissions = { read: 'own', create: true, update: 'own', delete: false }

export const variantsSchema: CollectionSchema = {
  name: 'variants',
  columns: [
    { name: 'experimentId', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    { name: 'channelName', storage: 'text', interpretation: 'plain', required: true },
    { name: 'slug', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    { name: 'outcomeCount', storage: 'number', interpretation: 'plain', default: 0 },
    { name: 'outcomeLabel', storage: 'text', interpretation: 'plain', default: '' },
    { name: 'reach', storage: 'number', interpretation: 'plain' },
    ownerColumn,
  ],
  // A slug is a public link, so no two variants may share one.
  uniqueOn: ['slug'],
  ownerField: 'ownerId',
  permissions: {
    '*': noAccess,
    viewer: noAccess,
    member: ownVariants,
    admin: ownVariants,
  },
}
