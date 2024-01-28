//https://fantasticdice.games/docs/usage/objects
type DiceboxConfig = {
  id?: string
  assetPath?: string
  gravity?: number
  mass?: number
  friction?: number
  restitution?: number
  angularDamping?: number
  linearDamping?: number
  spinForce?: number
  throwForce?: number
  startingHeight?: number
  settleTimeout?: number
  offscreen?: boolean
  delay?: number
  lightIntensity?: number
  enableShadows?: boolean
  shadowTransparency?: number
  suspendSimulation?: boolean
  scale?: number
  theme?: string
  themeColor?: string
  origin?: string
  meshFile?: string
}

type DieResult = {
  groupId: number
  rollId: number
  sides: number
  theme: string
  themeColor: string
  value: number
}

type DiceboxRollObject = {
  modifier?: number
  qty?: number
  sides: number | string
  theme?: string
  themeColor?: string
}

type RollNotation = string | string[] | DiceboxRollObject[]

type RollParameter =
  | RollNotation
  | DiceboxRollObject
  | DiceboxRollObject[]
  | DieResult

class Dicebox {
  constructor(arg0: string, arg1?: DiceboxConfig)

  getScene: () => BABYLON.Scene | null
  render: () => void
  resizeWorld: (size: { width: number; height: number }) => void
  clear: () => void
  hide: () => void
  show: () => void
  init: () => Promise<Dicebox>
  add: (arg: RollParameter) => Promise<DieResult[]>
  roll: (arg: RollParameter) => Promise<DieResult[]>
  updateConfig: (config: Partial<DiceboxConfig>) => Promise<void>
  reroll: (arg: RollParameter) => Promise<DieResult[]>
}

export = Dicebox
