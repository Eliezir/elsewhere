import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Snapshot } from '../types'
import { LIST_SCRIPT, insideRoot, parsePorts, relative, statusText } from './lib'

const PANE = 'workbench'
const REFRESH_MS = 5000

const snapshot = atom({ plugin: 'workbench', key: 'snapshot' } as const, null)
const confirming = atom({ plugin: 'workbench', key: 'confirming' } as const, null)

async function refresh($: EngineInterface, cwd: string): Promise<void> {
  const result = await $.process.run(['sh', '-c', LIST_SCRIPT], { cwd, timeoutMs: 15000 }).catch(() => null)
  if (result === null || result.exitCode !== 0) {
    await update($, snapshot, () => ({ cwd, rows: [], others: 0, updatedAt: Date.now(), error: 'Could not list the listening ports.' }))
    return
  }
  const all = parsePorts(result.stdout)
  const mine = all.filter(row => insideRoot(row.cwd, cwd))
  const next: Snapshot = { cwd, rows: mine, others: all.length - mine.length, updatedAt: Date.now(), error: null }
  await update($, snapshot, () => next)
  $.ui.status(statusText(mine))
}

async function kill($: EngineInterface, cwd: string, port: number, force: boolean): Promise<void> {
  const listing = await $.process.run(['sh', '-c', LIST_SCRIPT], { cwd, timeoutMs: 15000 }).catch(() => null)
  const row = listing === null ? undefined : parsePorts(listing.stdout).find(entry => entry.port === port)
  if (!row || !insideRoot(row.cwd, cwd)) {
    $.ui.toast(`Nothing from this folder is listening on :${port} any more.`)
  } else {
    await $.process.run(['kill', force ? '-KILL' : '-TERM', String(row.pid)]).catch(() => null)
    $.ui.toast(`Stopped :${port}.`)
  }
  await update($, confirming, () => null)
  await $.clock.sleep(1200)
  await refresh($, cwd)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'ports',
      description: 'Show the dev servers running from this folder, and stop them',
    })
    void refresh($, e.cwd)
    $.clock.every(REFRESH_MS, () => void refresh($, e.cwd))

    return next(e)
  })

  on('command.run', { command: 'ports' }, async $ => {
    await $.ui.open({ id: PANE, title: 'Ports' })

    return { text: 'Ports pane opened.' }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Button, Text } = $.ui.resolve(e)
    const state = await read($, snapshot)
    const pending = await read($, confirming)

    if (state === null) return <Text dimColor>Looking for running servers…</Text>

    return (
      <Box flexDirection="column">
        <Box>
          <Text dimColor>{state.cwd}</Text>
        </Box>
        {state.error !== null && <Text>{state.error}</Text>}
        {state.rows.length === 0 && state.error === null && <Text dimColor>Nothing from this folder is listening.</Text>}
        {state.rows.map(row => (
          <Box key={`row-${row.port}`}>
            <Text>:{row.port} </Text>
            <Text dimColor>
              {row.command} {relative(row.cwd, state.cwd)} {row.branch ?? ''}{' '}
            </Text>
            {pending === row.port ? (
              <Box>
                <Button key={`yes-${row.port}`} label="Stop it" variant="primary" onPress={() => kill($, state.cwd, row.port, false)} />
                <Button key={`force-${row.port}`} label="Force" onPress={() => kill($, state.cwd, row.port, true)} />
                <Button key={`no-${row.port}`} label="Cancel" onPress={() => update($, confirming, () => null)} />
              </Box>
            ) : (
              <Button key={`kill-${row.port}`} label="Kill" onPress={() => update($, confirming, () => row.port)} />
            )}
          </Box>
        ))}
        {state.others > 0 && <Text dimColor>{state.others} more listening outside this folder.</Text>}
        <Button key="refresh" label="Refresh" onPress={() => refresh($, state.cwd)} />
      </Box>
    )
  })
}
