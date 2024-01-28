import { useState, useEffect } from "react"

import * as BABYLON from "@babylonjs/core"

import { Inspector } from "@babylonjs/inspector"
import "@babylonjs/loaders/glTF/2.0/glTFLoader"

const init = (canvas: HTMLCanvasElement) => {
  const engine = new BABYLON.Engine(canvas, true, {
    preserveDrawingBuffer: true,
    stencil: true,
  })
  const scene = new BABYLON.Scene(engine)
  scene.clearColor = new BABYLON.Color4(41 / 255, 63 / 255, 148 / 255, 1)
  scene.ambientColor = BABYLON.Color3.White()

  scene.fogEnabled = false
  scene.createDefaultEnvironment({
    createGround: false,
    createSkybox: false,
  })
  scene.createDefaultCameraOrLight(true, true, true)

  return { engine, scene }
}

const loadGLB = async (scene: BABYLON.Scene) => {
  const data = await BABYLON.SceneLoader.ImportMeshAsync(
    undefined,
    "/assets/dice-box/models/test/test.glb",
    undefined,
    scene
  )
}

export const SimpleApp = () => {
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null)
  const [engine, setEngine] = useState<BABYLON.Engine | undefined>(undefined)
  const [scene, setScene] = useState<BABYLON.Scene | undefined>(undefined)

  // initialize engine
  useEffect(() => {
    if (canvas === null) {
      return
    }
    const { engine, scene } = init(canvas)
    setEngine(engine)
    setScene(scene)
    return () => {
      setScene(undefined)
      setEngine(undefined)
      engine.stopRenderLoop()
      engine.dispose()
    }
  }, [canvas])

  // initilize scene
  useEffect(() => {
    if (canvas === null || engine === undefined || scene === undefined) {
      return
    }

    engine.runRenderLoop(() => {
      scene.render()
    })
    let mounted = true
    loadGLB(scene).then(() => {
      if (!mounted) {
        return
      }
    })
    // scene.debugLayer.show()
    Inspector.Show(scene, {})
    return () => {
      mounted = false
      scene.dispose()
      engine.stopRenderLoop()
      engine.dispose()
    }
  }, [engine, canvas, scene])

  const canvasWidth = 768
  const canvasHeight = 768
  return (
    <div>
      <canvas
        ref={setCanvas}
        id={"canvas"}
        width={canvasWidth}
        height={canvasHeight}
        style={{
          border: "1px solid black",
          width: `${canvasWidth}px`,
          height: `${canvasHeight}px`,
        }}
      />
    </div>
  )
}
