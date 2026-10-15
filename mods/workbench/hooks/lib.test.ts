import { expect, test } from 'claude-code/testing'

import { insideRoot, parsePorts, relative, statusText } from './lib'

const OUTPUT = `5173|4321|node|/home/dev/Developer/worktrees/app/lisbon/apps/studio|feature/new-pipeline-ui
3001|4400|node|/home/dev/Developer/worktrees/app/lisbon/apps/api|feature/new-pipeline-ui
22|10|sshd||
3773|900|node-MainThread|/home/dev|
5173|9999|node|/elsewhere|dup
nonsense`

test('parsePorts keeps one row per port, skips ssh and junk, sorts by port', () => {
  const rows = parsePorts(OUTPUT)
  expect(rows.map(row => row.port)).toEqual([3001, 3773, 5173])
  expect(rows[2]?.pid).toBe(4321)
  expect(rows[1]?.branch).toBeNull()
})

test('insideRoot matches the folder and its children only', () => {
  const root = '/home/dev/Developer/worktrees/app/lisbon'
  expect(insideRoot(`${root}/apps/api`, root)).toBe(true)
  expect(insideRoot(root, root)).toBe(true)
  expect(insideRoot(`${root}-v2/apps`, root)).toBe(false)
  expect(insideRoot(null, root)).toBe(false)
})

test('statusText joins the branch and the ports', () => {
  expect(statusText([])).toBeUndefined()
  const rows = parsePorts(OUTPUT).filter(row => row.branch !== null)
  expect(statusText(rows)).toBe('feature/new-pipeline-ui · :3001 :5173')
})

test('relative shows the folder inside the root', () => {
  expect(relative('/r/apps/api', '/r')).toBe('apps/api')
  expect(relative('/r', '/r')).toBe('.')
  expect(relative(null, '/r')).toBe('')
})
