import { describe, expect, it } from 'vitest'
import { lintSchema } from 'deepspace/worker'
import { schemas } from '../schemas'
import { isHttpUrl } from './experiments-schema'
import { newSlug, SLUG_PATTERN } from './variants-schema'

describe('schemas', () => {
  it.each(schemas.map((s) => [s.name, s] as const))('%s has no schema-lint warnings', (_name, schema) => {
    expect(lintSchema(schema)).toEqual([])
  })

  it('generated slugs match what the click route accepts', () => {
    for (let i = 0; i < 200; i++) expect(newSlug()).toMatch(SLUG_PATTERN)
  })

  it('only http(s) destinations are allowed', () => {
    expect(isHttpUrl('https://example.com/a?b=1')).toBe(true)
    expect(isHttpUrl('http://example.com')).toBe(true)
    for (const bad of ['javascript:alert(1)', 'data:text/html,x', 'ftp://x.y', 'example.com', ''])
      expect(isHttpUrl(bad)).toBe(false)
  })
})
