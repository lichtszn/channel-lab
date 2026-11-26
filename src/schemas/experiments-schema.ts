import type { CollectionSchema, RolePermissions } from 'deepspace/schema'

export const DECISIONS = ['none', 'keep', 'change', 'stop'] as const
export type Decision = (typeof DECISIONS)[number]

export type Experiment = {
  title: string
  hypothesis: string
  audience: string
  successMetric: string
  destinationUrl: string
  decision: Decision
  decisionReason: string
  /** Set by the server to the creator's user id; clients cannot choose it. */
  ownerId?: string
}

/**
 * Experiments: signed-in users (members, and admins including the app owner)
 * read and edit only their own. Creating, deciding and changing the destination
 * go through server actions that validate the values; nobody can delete.
 */
const ownExperiments: RolePermissions = {
  read: 'own',
  create: false,
  update: 'own',
  delete: false,
  writableFields: ['title', 'hypothesis', 'audience', 'successMetric'],
}

/** Signed-out visitors (`*`) and viewers get nothing. */
export const noAccess: RolePermissions = {
  read: false,
  create: false,
  update: false,
  delete: false,
}

/**
 * Ownership follows the docs: `ownerField` names the column, and that column is
 * `userBound` (the server writes the caller's id on create) and `immutable`.
 */
export const ownerColumn = {
  name: 'ownerId',
  storage: 'text',
  interpretation: 'plain',
  userBound: true,
  immutable: true,
} as const

export const experimentsSchema: CollectionSchema = {
  name: 'experiments',
  columns: [
    { name: 'title', storage: 'text', interpretation: 'plain', required: true },
    { name: 'hypothesis', storage: 'text', interpretation: 'plain', default: '' },
    { name: 'audience', storage: 'text', interpretation: 'plain', default: '' },
    { name: 'successMetric', storage: 'text', interpretation: 'plain', default: '' },
    { name: 'destinationUrl', storage: 'text', interpretation: { kind: 'url' }, required: true },
    {
      name: 'decision',
      storage: 'text',
      interpretation: { kind: 'select', options: [...DECISIONS] },
      default: 'none',
    },
    { name: 'decisionReason', storage: 'text', interpretation: 'plain', default: '' },
    ownerColumn,
  ],
  ownerField: 'ownerId',
  permissions: {
    '*': noAccess,
    viewer: noAccess,
    member: ownExperiments,
    admin: ownExperiments,
  },
}

export function isDecision(value: unknown): value is Decision {
  return typeof value === 'string' && (DECISIONS as readonly string[]).includes(value)
}

/** Only http(s) links may be destinations, so a link can never run script. */
export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}
