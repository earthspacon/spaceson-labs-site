import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { localTree } from '../sources/local-tree.js'

const DIR = join(import.meta.dirname, 'fixtures', 'tiny-repo')

describe('localTree', () => {
  it('lists files without dependency folders and reads them', async () => {
    const source = await localTree({ dir: DIR, name: 'tiny' }).open({ now: () => 0 })

    expect(source.files.map((file) => file.path).sort()).toEqual(['package.json', 'src/a.ts'])
    expect((await source.readFiles({ paths: [{ path: 'src/a.ts' }] })).get('src/a.ts')).toBe('export const a = 1\n')
  })

  it('reports no commit for a folder that is not its own repo', async () => {
    const source = await localTree({ dir: DIR, name: 'tiny' }).open({ now: () => 0 })

    expect(source.commit).toBeNull()
    expect(source.info).toBeNull()
  })
})
