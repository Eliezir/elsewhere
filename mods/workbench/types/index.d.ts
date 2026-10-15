export type PortRow = {
  port: number
  pid: number
  command: string
  cwd: string | null
  branch: string | null
}

export type Snapshot = {
  cwd: string
  rows: PortRow[]
  others: number
  updatedAt: number
  error: string | null
}

declare module 'claude-code' {
  interface PluginState {
    workbench: {
      snapshot: Snapshot | null
      confirming: number | null
    }
  }
}
