import type { CollectionSchema, RolePermissions } from 'deepspace/schema'

/**
 * One row per readout slot used. A readout first claims a per-user slot
 * (scope `user:<id>`, slots 1..3) and an app-wide slot (scope `app`, slots
 * 1..10) for the UTC day. `uniqueOn` makes the record room refuse a second row
 * for the same scope, day and slot, so concurrent requests cannot both take
 * the last slot. Only server actions write or read here.
 */
const none: RolePermissions = { read: false, create: false, update: false, delete: false }

export const readoutUsageSchema: CollectionSchema = {
  name: 'readout_usage',
  columns: [
    // Every column in uniqueOn is required: null values would never conflict.
    { name: 'scope', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    { name: 'day', storage: 'text', interpretation: 'plain', required: true, immutable: true },
    { name: 'slot', storage: 'number', interpretation: 'plain', required: true, immutable: true },
    { name: 'userId', storage: 'text', interpretation: 'plain', required: true, immutable: true },
  ],
  uniqueOn: ['scope', 'day', 'slot'],
  permissions: { '*': none, viewer: none, member: none, admin: none },
}
