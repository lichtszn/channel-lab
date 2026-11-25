/**
 * CronRoom lets members and admins trigger, pause and resume tasks. Only admins
 * may do that here, so every other role joins as a read-only viewer.
 */
export function cronRoomRole(appRole: string): 'admin' | 'viewer' {
  return appRole === 'admin' ? 'admin' : 'viewer'
}
