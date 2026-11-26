import { getAuthToken } from 'deepspace'

export type ActionReply<T> = { success: true; data: T } | { success: false; error: string }

/** Calls a server action as the signed-in user. Never throws; failures come back as `success: false`. */
export async function runAction<T = { recordId: string }>(
  name: string,
  params: Record<string, unknown>,
): Promise<ActionReply<T>> {
  try {
    const token = await getAuthToken()
    if (!token) return { success: false, error: 'You are signed out. Sign in and try again.' }
    const res = await fetch(`/api/actions/${name}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(params),
    })
    const body = (await res.json().catch(() => null)) as ActionReply<T> | null
    if (!body) return { success: false, error: `The server answered ${res.status}.` }
    return body.success ? body : { success: false, error: body.error || 'Something went wrong.' }
  } catch {
    return { success: false, error: 'Could not reach the server. Check your connection.' }
  }
}
