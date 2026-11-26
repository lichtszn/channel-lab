/**
 * Collection Schemas
 *
 * All collections with columns and RBAC permissions.
 * Single source of truth — imported by both worker and frontend.
 *
 * Add schemas by creating a file in src/schemas/ and importing it here.
 */

import type { CollectionSchema } from 'deepspace/schema'
import { usersSchema } from './schemas/users-schema'
import { settingsSchema } from './schemas/admin-schema'
import { clicksSchema } from './schemas/clicks-schema'
import { experimentsSchema } from './schemas/experiments-schema'
import { variantsSchema } from './schemas/variants-schema'
import { readoutUsageSchema } from './schemas/readout-usage-schema'

export const schemas: CollectionSchema[] = [
  usersSchema,
  settingsSchema,
  clicksSchema,
  experimentsSchema,
  variantsSchema,
  readoutUsageSchema,
]
