import { describe, expect, it } from 'vitest'
import { cronRoomRole } from './cron-role'

describe('cronRoomRole', () => {
  it('keeps admins as admins', () => {
    expect(cronRoomRole('admin')).toBe('admin')
  })

  it.each(['member', 'viewer', '', 'owner'])('makes %j read-only', (role) => {
    expect(cronRoomRole(role)).toBe('viewer')
  })
})
