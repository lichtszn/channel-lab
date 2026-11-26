/**
 * Server actions. They run with permissions OFF (see src/server/action-routes.ts),
 * so every action checks ownership against the verified caller itself.
 * None of these make paid calls.
 */
import type { ActionHandler, ActionResult, ActionTools } from 'deepspace/worker'
import type { Env } from '../../worker'
import { isDecision, isHttpUrl } from '../schemas/experiments-schema'
import { generateReadout } from './readout'

const MAX_TEXT = 2000

function text(value: unknown, max = MAX_TEXT): string | null {
  if (value === undefined || value === null) return ''
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > max ? null : trimmed
}

/** Loads a row and confirms the caller owns it. Unknown and not-yours look the same. */
async function loadOwn(
  tools: ActionTools,
  collection: string,
  recordId: unknown,
  userId: string,
): Promise<ActionResult<Record<string, unknown>>> {
  const notFound = { success: false as const, error: 'Not found' }
  if (typeof recordId !== 'string' || !recordId) return notFound
  const found = await tools.get(collection, recordId)
  if (!found.success || found.data.record.data.ownerId !== userId) return notFound
  return { success: true, data: found.data.record.data }
}

export const createExperiment: ActionHandler<Env> = async ({ params, tools }) => {
  const title = text(params.title, 200)
  const hypothesis = text(params.hypothesis)
  const audience = text(params.audience)
  const successMetric = text(params.successMetric)
  const destinationUrl = text(params.destinationUrl)
  if (!title) return { success: false, error: 'Give the experiment a title (up to 200 characters).' }
  if (hypothesis === null || audience === null || successMetric === null)
    return { success: false, error: `Text fields can be up to ${MAX_TEXT} characters.` }
  if (!destinationUrl || !isHttpUrl(destinationUrl))
    return { success: false, error: 'The destination must be a full http:// or https:// link.' }

  // ownerId is userBound: the record room stamps the verified caller's id.
  return tools.create('experiments', {
    title,
    hypothesis,
    audience,
    successMetric,
    destinationUrl,
    decision: 'none',
    decisionReason: '',
  })
}

export const setDecision: ActionHandler<Env> = async ({ params, tools, userId }) => {
  const own = await loadOwn(tools, 'experiments', params.experimentId, userId)
  if (!own.success) return own
  if (!isDecision(params.decision))
    return { success: false, error: 'Decision must be none, keep, change or stop.' }
  const reason = text(params.reason, 500)
  if (reason === null) return { success: false, error: 'The reason can be up to 500 characters.' }
  return tools.update('experiments', params.experimentId as string, {
    decision: params.decision,
    decisionReason: reason,
  })
}

/** Deletes a channel only if it has no clicks, so click data is never orphaned. */
export const deleteChannel: ActionHandler<Env> = async ({ params, tools, userId }) => {
  const own = await loadOwn(tools, 'variants', params.variantId, userId)
  if (!own.success) return own
  const clicks = await tools.query('clicks', { where: { variant: params.variantId }, limit: 1 })
  if (!clicks.success) return { success: false, error: 'Could not check this channel for clicks.' }
  if (clicks.data.records.length > 0)
    return { success: false, error: 'This channel has clicks, so it cannot be deleted. Rename it instead.' }
  return tools.remove('variants', params.variantId as string)
}

export const actions: Record<string, ActionHandler<Env>> = {
  createExperiment,
  setDecision,
  deleteChannel,
  generateReadout,
}
