export function lerp(a: number, b: number, alpha: number) {
  return a * (1 - alpha) + b * alpha
}

/**
 * Function Queue - ensures async function calls are triggered in the order they are queued
 * By David Adler (david_adler) @ https://stackoverflow.com/questions/53540348/js-async-await-tasks-queue
 * @param  {object} opts Option to dedupe concurrent executions
 * @return {object} returns object with "push" function, "queue" array, and "flush" function
 */
type AsyncQueueOptions = {
  dedupe: boolean
}

type Task = () => Promise<any>

export const createAsyncQueue = (
  opts: AsyncQueueOptions = { dedupe: false }
) => {
  const { dedupe } = opts
  let queue: Task[] = []
  let running: Promise<any[] | undefined> | undefined

  const push = (task: Task): Promise<any[] | undefined> => {
    if (dedupe) queue = []
    queue.push(task)
    if (!running)
      running = start().finally(() => {
        running = undefined
      })
    return running
  }

  const start = async (): Promise<any[]> => {
    const res: any[] = []
    while (queue.length) {
      const item = queue.shift()
      if (item) {
        res.push(await item())
      }
    }
    return res
  }

  return {
    push,
    queue,
    flush: (): Promise<any[] | undefined> => running || Promise.resolve([]),
  }
}

// deep copy objects and break references to original object
// Note: does not work with the 'scene' object or objects with circular references
export const deepCopy = (obj: any): any => JSON.parse(JSON.stringify(obj))

// Sleeper function to delay execution for testing
export const sleeper = (ms: number) => {
  return new Promise<void>((resolve) => setTimeout(() => resolve(), ms))
}

export class Random {
  /**
   * Generate a random number between 0 (inclusive) and 1 (exclusive).
   * A drop in replacement for Math.random()
   * @return {number}
   */
  static value(): number {
    // @ts-ignore
    const crypto = window.crypto || window.msCrypto
    const buffer = new Uint32Array(1)
    const int = crypto.getRandomValues(buffer)[0]

    return int / 2 ** 32
  }
  /**
   * Generate a very good random number between min (inclusive) and max (exclusive) by using crypto.getRandomValues() twice.
   * @param  {number} min
   * @param  {number} max
   * @return {number}
   */
  static range(min: number, max: number): number {
    // return Math.floor(this.value() * (max - min) + min); // plain random
    return (
      (Math.floor(Math.pow(10, 14) * this.value() * this.value()) %
        (max - min + 1)) +
      min
    ) // super random!
  }
}

// https://www.30secondsofcode.org/c/js-colors/p/1
export const hexToRGB = (hex: string) => {
  let alpha = false,
    h = hex.slice(hex.startsWith("#") ? 1 : 0)
  if (h.length === 3) h = [...h].map((x) => x + x).join("")
  else if (h.length === 8) alpha = true
  let n = parseInt(h, 16)
  let val = {
    r: n >>> 16,
    g: (n & 0x00ff00) >>> 8,
    b: n & 0x0000ff,
  }
  if (alpha) {
    return {
      r: n >>> 24,
      g: (n & 0x00ff0000) >>> 16,
      b: (n & 0x0000ff00) >>> 8,
      a: n & 0x000000ff,
    }
  }
  return {
    r: n >>> 16,
    g: (n & 0x00ff00) >>> 8,
    b: n & 0x0000ff,
  }
}

export const RGBToHSB = (r: number, g: number, b: number) => {
  r /= 255
  g /= 255
  b /= 255
  const v = Math.max(r, g, b),
    n = v - Math.min(r, g, b)
  const h =
    n === 0
      ? 0
      : n && v === r
      ? (g - b) / n
      : v === g
      ? 2 + (b - r) / n
      : 4 + (r - g) / n
  return [60 * (h < 0 ? h + 6 : h), v && (n / v) * 100, v * 100]
}

export const hexToHSB = (hex: string) => {
  const rgb = hexToRGB(hex)
  return RGBToHSB(rgb.r, rgb.g, rgb.b)
}
