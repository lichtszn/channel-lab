/**
 * Reads click rows straight from the LOCAL dev database. Test accounts are
 * members and cannot read the clicks collection, so this is how a local test
 * confirms the click route wrote a row. It never touches the live site.
 */

import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'

const STATE_DIR = fileURLToPath(new URL('../../.wrangler/state', import.meta.url))

function sqliteFiles(dir: string): string[] {
  let found: string[] = []
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) found = found.concat(sqliteFiles(path))
    else if (name.endsWith('.sqlite')) found.push(path)
  }
  return found
}

export function countLocalClicks(variantId: string): number {
  let total = 0
  for (const file of sqliteFiles(STATE_DIR)) {
    const db = new DatabaseSync(file, { readOnly: true })
    try {
      const tables = db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE '%clicks%'")
        .all() as { name: string }[]
      for (const { name } of tables) {
        const row = db
          .prepare(`SELECT COUNT(*) AS n FROM "${name}" WHERE col_variant = ?`)
          .get(variantId) as { n: number }
        total += row.n
      }
    } finally {
      db.close()
    }
  }
  return total
}
