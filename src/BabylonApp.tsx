import { useState, useEffect, useRef, useCallback } from "react"

import * as BABYLON from "@babylonjs/core"
import { CustomMaterial } from "@babylonjs/materials"

import { Inspector } from "@babylonjs/inspector"
import "@babylonjs/loaders/glTF/2.0/glTFLoader"

const DEBUG = false

const createDebugObjects = (scene: BABYLON.Scene) => {
  const axes = new BABYLON.AxesViewer(scene, 1)
  return { axes }
}

const createEngine = (canvas: HTMLCanvasElement) => {
  return new BABYLON.Engine(canvas, true, {
    preserveDrawingBuffer: true,
    stencil: true,
  })
}

const createScene = (engine: BABYLON.Engine) => {
  const scene = new BABYLON.Scene(engine)
  scene.clearColor = new BABYLON.Color4(41 / 255, 63 / 255, 148 / 255, 1)
  scene.ambientColor = BABYLON.Color3.White()

  scene.fogEnabled = false
  scene.createDefaultEnvironment({
    createGround: false,
    createSkybox: false,
  })

  const optimizationSettings =
    BABYLON.SceneOptimizerOptions.LowDegradationAllowed(60)

  // remove merge optimizer
  optimizationSettings.optimizations =
    optimizationSettings.optimizations.splice(1)

  BABYLON.SceneOptimizer.OptimizeAsync(scene, optimizationSettings)

  return scene
}

const createCamera = (canvas: HTMLCanvasElement, scene: BABYLON.Scene) => {
  const camera = new BABYLON.ArcRotateCamera(
    "Camera",
    Math.PI / 2,
    Math.PI / 4,
    5,
    BABYLON.Vector3.Zero(),
    scene
  )
  camera.setTarget(BABYLON.Vector3.Zero())
  camera.attachControl(canvas, true, true)

  //camera.zoomToMouseLocation = true;
  camera.wheelDeltaPercentage = 0.01
  camera.minZ = 0.1

  return camera
}

const createLights = ({
  intensity,
  scene,
}: {
  intensity: number
  scene: BABYLON.Scene
}) => {
  const d_light = new BABYLON.DirectionalLight(
    "DirectionalLight",
    new BABYLON.Vector3(-0.3, -1, 0.4),
    scene
  )
  d_light.position = new BABYLON.Vector3(-50, 65, -50)
  d_light.intensity = 0.65 * intensity

  const h_light = new BABYLON.HemisphericLight(
    "HemisphericLight",
    new BABYLON.Vector3(1, 1, 0),
    scene
  )
  h_light.intensity = 0.4 * intensity

  return { directional: d_light, hemispheric: h_light }
}

const loadTexture = async (
  url: string,
  scene: BABYLON.Scene
): Promise<BABYLON.Texture> => {
  return new Promise<BABYLON.Texture>((resolve, reject) => {
    const texture: BABYLON.Texture = new BABYLON.Texture(
      url, // url: Nullable<string>
      scene, // sceneOrEngine: Nullable<Scene | ThinEngine>
      undefined, // noMipmapOrOptions?: boolean | ITextureCreationOptions
      false, // invertY?: boolean - WHY?
      undefined, // samplingMode?: number
      () => resolve(texture), // onLoad
      () => reject(`Unable to load texture '${url}'`) // onError
    )
  })
}

const loadColorMaterial = async (scene: BABYLON.Scene) => {
  const material = new CustomMaterial("dice", scene)
  const diffuseTexture = await loadTexture(
    "assets/dice-box/themes/qp/diffuse.png",
    scene
  )
  material.diffuseTexture = diffuseTexture

  const bumpTexture = await loadTexture(
    "assets/dice-box/themes/qp/normal.png",
    scene
  )
  material.bumpTexture = bumpTexture

  const specularTexture = await loadTexture(
    "assets/dice-box/themes/qp/specular.png",
    scene
  )
  material.specularTexture = specularTexture

  material.allowShaderHotSwapping = false

  // the magic that allows for the material color to be changed on instances
  material.Vertex_Definitions(`
  attribute vec3 customColor;
  varying vec3 vColor;
`).Vertex_MainEnd(`
  vColor = customColor;
`).Fragment_Definitions(`
  varying vec3 vColor;
`).Fragment_Custom_Diffuse(`
  baseColor.rgb = mix(vColor.rgb, baseColor.rgb, baseColor.a);
`)
  material.AddAttribute("customColor")

  return material
}

const loadMaterials = async ({
  modelFile,
  rootPath,
  scene,
}: {
  modelFile: string
  rootPath: string
  scene: BABYLON.Scene
}) => {
  const data = await BABYLON.SceneLoader.ImportMeshAsync(
    null,
    rootPath,
    modelFile,
    scene
  )
  const materials: BABYLON.Material[] = []
  for (const mesh of data.meshes) {
    if (mesh.parent?.name === "__root__") {
      // detach all meshes from the root
      mesh.setParent(null)
    }
    mesh.setEnabled(false)
    if (mesh.material !== null) {
      materials.push(mesh.material)
    }
  }
  return materials
}

const loadMeshes = async ({
  modelFile,
  rootPath,
  scene,
  disableMeshes = true,
}: {
  modelFile: string
  rootPath: string
  scene: BABYLON.Scene
  disableMeshes?: boolean
}) => {
  const data = await BABYLON.SceneLoader.ImportMeshAsync(
    null,
    rootPath,
    modelFile,
    scene
  )
  if (disableMeshes) {
    for (const mesh of data.meshes) {
      mesh.setEnabled(false)
      if (mesh.parent?.name === "__root__") {
        // detach all meshes from the root
        mesh.setParent(null)
      }
    }
  }
  if (DEBUG) {
    console.log("loadMeshes", {
      animationGroups: data.animationGroups.length,
      geometries: data.geometries.length,
      lights: data.lights.length,
      meshes: data.meshes.length,
      particleSystems: data.particleSystems.length,
      skeletons: data.skeletons.length,
      transformNodes: data.transformNodes.length,
    })
  }
  return data.meshes
}

type NodeGroups = {
  colliders: BABYLON.Mesh[]
  dice: BABYLON.Mesh[]
  instances: BABYLON.InstancedMesh[]
  other: BABYLON.Mesh[]
}

const emptyNodeGroup: NodeGroups = {
  colliders: [],
  dice: [],
  instances: [],
  other: [],
}

const groupNodes = (scene: BABYLON.Scene): NodeGroups => {
  const colliders: BABYLON.Mesh[] = []
  const dice: BABYLON.Mesh[] = []
  const other: BABYLON.Mesh[] = []
  const instances: BABYLON.InstancedMesh[] = []
  for (const node of scene.getNodes()) {
    switch (node.getClassName()) {
      case "Mesh": {
        const mesh = node as BABYLON.Mesh
        if (mesh.name.includes("collider")) {
          colliders.push(mesh)
        } else if (mesh.name.startsWith("d")) {
          dice.push(mesh)
        } else {
          other.push(mesh)
        }
        break
      }
      case "InstancedMesh": {
        instances.push(node as BABYLON.InstancedMesh)
        break
      }
      default:
    }
  }
  colliders.sort((a, b) => a.name.localeCompare(b.name))
  dice.sort((a, b) => a.name.localeCompare(b.name))
  other.sort((a, b) => a.name.localeCompare(b.name))
  instances.sort((a, b) => a.name.localeCompare(b.name))
  return { colliders, dice, other, instances }
}

const attachMeshControls = (
  scene: BABYLON.Scene,
  camera: BABYLON.ArcRotateCamera,
  onPick?: (pickInfo: BABYLON.PickingInfo) => void
) => {
  let rotatingMesh: BABYLON.AbstractMesh | undefined = undefined
  const sensitivity = 0.01
  scene.onPointerObservable.add((pointerInfo) => {
    if (pointerInfo.type === BABYLON.PointerEventTypes.POINTERDOWN) {
      const pickedMesh = pointerInfo.pickInfo?.pickedMesh
      if (pickedMesh === null || pickedMesh === undefined) {
        return
      }
      rotatingMesh = pickedMesh
      camera.detachControl()
    } else if (
      pointerInfo.type === BABYLON.PointerEventTypes.POINTERUP &&
      rotatingMesh
    ) {
      rotatingMesh = undefined
      camera.attachControl()
    } else if (
      pointerInfo.type === BABYLON.PointerEventTypes.POINTERMOVE &&
      rotatingMesh
    ) {
      const deltaX = -(pointerInfo.event.movementX * sensitivity)
      const deltaY = -(pointerInfo.event.movementY * sensitivity)

      // Get rotation axes from the camera's view matrix
      // const matrix = camera.getViewMatrix()
      const matrix = camera.getWorldMatrix()
      const rightAxis = new BABYLON.Vector3(
        matrix.m[0],
        matrix.m[1],
        matrix.m[2]
      )
      const upAxis = new BABYLON.Vector3(matrix.m[4], matrix.m[5], matrix.m[6])
      // vertical mouse movement
      rotatingMesh.rotate(rightAxis, deltaY, BABYLON.Space.WORLD)
      // horizontal mouse movement
      rotatingMesh.rotate(upAxis, deltaX, BABYLON.Space.WORLD)
    } else if (pointerInfo.type === 64) {
      const pickedMesh = pointerInfo.pickInfo?.pickedMesh
      if (pickedMesh === null || pickedMesh === undefined) {
        return
      }
      //renderFaceIDsOnMesh(scene, pickedMesh as BABYLON.Mesh)
      camera.setTarget(pickedMesh)
      camera.radius = 0.5
    } else if (pointerInfo.type == BABYLON.PointerEventTypes.POINTERTAP) {
      const pickInfo = pointerInfo.pickInfo
      if (pickInfo === null || pickInfo === undefined) {
        return
      }
      onPick?.(pickInfo)
    }
  })
}

const loadColorDice = async (scene: BABYLON.Scene) => {
  const material = await loadColorMaterial(scene)
  // material.wireframe = true
  let nodeGroups = groupNodes(scene)
  for (const mesh of nodeGroups.dice) {
    // instancedBuffers only work on instances of a mesh
    // so we create an instance of each mesh and set the instancedBuffer
    // to a random color and hide the mesh
    mesh.material = material
    mesh.registerInstancedBuffer("customColor", 3)
    mesh.instancedBuffers["customColor"] = BABYLON.Color3.Random()
    mesh.isVisible = false

    const instance = mesh.createInstance(mesh.name + "_instance")
    instance.isVisible = true
    instance.instancedBuffers["customColor"] = BABYLON.Color3.Random()
  }

  for (const mesh of nodeGroups.colliders) {
    mesh.material = material
    mesh.registerInstancedBuffer("customColor", 3)
    mesh.instancedBuffers["customColor"] = BABYLON.Color3.Random()
  }
}

const loadThemeDice = async (scene: BABYLON.Scene, theme: string) => {
  const materials = await loadMaterials({
    modelFile: `${theme}.glb`,
    rootPath: `http://localhost:5173/assets/dice-box/themes/${theme}/`,
    scene,
  })
  const material = materials[0]
  // material.wireframe = true
  let nodeGroups = groupNodes(scene)
  for (const mesh of nodeGroups.dice) {
    mesh.setEnabled(true)
    mesh.material = material
  }

  for (const mesh of nodeGroups.colliders) {
    mesh.material = material
  }
}

function renderFaceIDsOnMesh(scene: BABYLON.Scene, mesh: BABYLON.Mesh) {
  let indices = mesh.getIndices()
  let vertices = mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind)

  if (!indices || !vertices) {
    return
  }

  let worldMatrix = mesh.computeWorldMatrix(true)

  for (let i = 0; i < indices.length; i += 3) {
    let vertexIndex1 = indices[i] * 3
    let vertexIndex2 = indices[i + 1] * 3
    let vertexIndex3 = indices[i + 2] * 3

    let p1 = BABYLON.Vector3.FromArray(vertices, vertexIndex1)
    let p2 = BABYLON.Vector3.FromArray(vertices, vertexIndex2)
    let p3 = BABYLON.Vector3.FromArray(vertices, vertexIndex3)

    p1 = BABYLON.Vector3.TransformCoordinates(p1, worldMatrix)
    p2 = BABYLON.Vector3.TransformCoordinates(p2, worldMatrix)
    p3 = BABYLON.Vector3.TransformCoordinates(p3, worldMatrix)

    // Create custom mesh (triangle)
    let customMesh = new BABYLON.Mesh("custom", scene)

    let vertexData = new BABYLON.VertexData()
    BABYLON.VertexData.ComputeNormals([p1, p2, p3], [0, 1, 2], []) // Compute normals for the custom mesh

    vertexData.positions = [
      p1.x,
      p1.y,
      p1.z,
      p2.x,
      p2.y,
      p2.z,
      p3.x,
      p3.y,
      p3.z,
    ]

    vertexData.indices = [0, 1, 2]

    vertexData.applyToMesh(customMesh, true)

    // Set mesh material to a solid color for visualization
    // let material = new BABYLON.StandardMaterial("TriangleMaterial", scene)
    // material.diffuseColor = new BABYLON.Color3(1, 0, 0) // Red color for visibility
    // material.specularColor = new BABYLON.Color3(0, 0, 0) // Non-reflective

    // Prepare a dynamic texture for the face IDs
    let textureSize = 512
    let dynamicTexture = new BABYLON.DynamicTexture(
      "DynamicTexture",
      textureSize,
      scene,
      true
    )
    dynamicTexture.hasAlpha = true
    dynamicTexture.drawText(
      "",
      null,
      null,
      "bold 44px Arial",
      "white",
      "transparent",
      true
    )
    dynamicTexture.update(true) // Update the texture so that it's not blank

    // Create a standard material using the dynamic texture
    let faceMaterial = new BABYLON.StandardMaterial("FaceMaterial", scene)
    faceMaterial.diffuseTexture = dynamicTexture
    //faceMaterial.diffuseColor = new BABYLON.Color3(1, 0, 0) // Red color for visibility
    faceMaterial.specularColor = new BABYLON.Color3(0, 0, 0) // Non-reflective

    customMesh.material = faceMaterial
    customMesh.renderingGroupId = 1
  }
}

const initScene = ({
  engine,
  canvas,
  onPick,
}: {
  engine: BABYLON.Engine
  canvas: HTMLCanvasElement
  onPick?: (pickInfo: BABYLON.PickingInfo) => void
}) => {
  const scene = createScene(engine)
  const camera = createCamera(canvas, scene)
  createLights({ intensity: 1, scene })
  attachMeshControls(scene, camera, onPick)
  return { scene, camera }
}

const initDice = async ({
  scene,
  diceTheme,
}: {
  scene: BABYLON.Scene
  diceTheme: DiceTheme
}) => {
  const modelFile = "default.glb"
  const rootPath = "http://localhost:5173/assets/dice-box/models/default/"

  /*
  // new textures are not working with this
  const modelFile = "qp.json"
  const rootPath = "http://localhost:5173/assets/dice-box/models/"
  */
  await loadMeshes({
    modelFile,
    rootPath,
    scene,
    disableMeshes: true,
  })

  const groups = groupNodes(scene)
  for (const mesh of groups.colliders) {
    mesh.isPickable = true
  }
  for (const mesh of groups.dice) {
    mesh.isPickable = true
  }
  for (const mesh of groups.instances) {
    mesh.isPickable = true
  }

  if (diceTheme === "color") {
    await loadColorDice(scene)
  } else {
    await loadThemeDice(scene, diceTheme)
  }
}

const useForceRerender = () => {
  const [, setCounter] = useState(0)
  return useCallback(() => setCounter((c) => c + 1), [])
}

const MeshTable = ({
  name,
  meshes,
  camera,
}: {
  name: string
  meshes: BABYLON.AbstractMesh[]
  camera?: BABYLON.ArcRotateCamera
}) => {
  const forceRender = useForceRerender()
  const isAnyEnabled = meshes.some((mesh) => mesh.isEnabled())
  return (
    <table>
      <thead>
        <tr>
          <th>{name}</th>
          <th>Focus</th>
          <th>
            <button
              onClick={() => {
                for (const mesh of meshes) {
                  mesh.setEnabled(!isAnyEnabled)
                }
                forceRender()
              }}
            >
              {isAnyEnabled ? "Disable all" : "Enable all"}
            </button>
          </th>
          <th>
            <button
              onClick={() => {
                meshes.forEach((mesh) => {
                  mesh.rotationQuaternion = new BABYLON.Quaternion()
                })
              }}
            >
              Reset all
            </button>
          </th>
        </tr>
      </thead>
      <tbody>
        {meshes.map((mesh) => (
          <tr key={mesh.id}>
            <td>
              {mesh.name} - {mesh.id}
            </td>
            <td>
              <button
                onClick={() => {
                  if (camera === undefined) {
                    return
                  }
                  camera.setTarget(mesh)
                  camera.radius = 0.5
                }}
              >
                Focus
              </button>
            </td>
            <td>
              <button
                onClick={() => {
                  mesh.setEnabled(!mesh.isEnabled())
                  forceRender()
                }}
              >
                {mesh.isEnabled() ? "Disable" : "Enable"}
              </button>
            </td>
            <td>
              <button
                onClick={() => {
                  mesh.rotationQuaternion = new BABYLON.Quaternion()
                }}
              >
                Reset
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

const MeshTables = ({
  groups,
  camera,
}: {
  groups: NodeGroups
  camera?: BABYLON.ArcRotateCamera
}) => {
  const headerStyle = {
    marginBlockStart: "4px",
    marginBlockEnd: "4px",
  }
  const showInstances = groups.instances.length > 0
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      <MeshTable name="Dice" meshes={groups.dice} camera={camera} />
      {showInstances ? (
        <MeshTable name="Instances" meshes={groups.instances} camera={camera} />
      ) : null}
      <MeshTable name="Colliders" meshes={groups.colliders} camera={camera} />
      <MeshTable name="Other" meshes={groups.other} camera={camera} />
    </div>
  )
}

type DiceTheme = "color" | "marble"

const DiceThemeSelector = ({
  onChange,
  value,
}: {
  onChange: (value: DiceTheme) => void
  value: DiceTheme
}) => {
  return (
    <select
      onChange={(e) => {
        onChange(e.target.value as DiceTheme)
      }}
      value={value}
    >
      <option value="marble">Marble</option>
      <option value="color">Color</option>
    </select>
  )
}

type DiceFaceInfo = {
  diceName: string
  faceId: number
  value?: number
}

const DiceFaceInfoView = ({ info }: { info?: DiceFaceInfo }) => {
  if (info === undefined) {
    return null
  }
  return (
    <div
      style={{
        display: "flex",
        width: "100%",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div>{info.diceName}</div>
        <div>FaceId {info.faceId}</div>
        {/*info.value ? <div>Number {info.value}</div> : null*/}
      </div>
    </div>
  )
}

export const BabylonApp = () => {
  const [nodeGroups, setNodeGroups] = useState<NodeGroups>(emptyNodeGroup)
  const [engine, setEngine] = useState<BABYLON.Engine | undefined>(undefined)
  const [camera, setCamera] = useState<BABYLON.ArcRotateCamera | undefined>(
    undefined
  )
  const [diceTheme, setDiceTheme] = useState<DiceTheme>("color")
  const fpsElementRef = useRef<HTMLDivElement | null>(null)
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null)
  const [diceFaceInfo, setDiceFaceInfo] = useState<DiceFaceInfo | undefined>(
    undefined
  )

  // initialize engine
  useEffect(() => {
    if (canvas === null) {
      return
    }
    const engine = createEngine(canvas)
    setEngine(engine)
    return () => {
      setEngine(undefined)
      engine.stopRenderLoop()
      engine.dispose()
    }
  }, [canvas])

  const onPick = useCallback(
    (pickInfo: BABYLON.PickingInfo) => {
      const mesh = pickInfo.pickedMesh as BABYLON.Mesh
      const faceId = pickInfo.faceId
      if (mesh === null) {
        return
      }
      if (!mesh.name.includes("collider")) {
        // only allow picking colliders
        return
      }

      const diceName = mesh.name.replace("_collider", "")
      const colliderFaceMap: any = {}
      const diceFaceIdValues = colliderFaceMap[diceName]
      if (diceFaceIdValues === undefined) {
        setDiceFaceInfo({ diceName, faceId })
        return
      }
      const value = diceFaceIdValues[faceId]
      console.log(diceName, faceId, value)
      setDiceFaceInfo({ diceName, faceId, value })
    },
    [setDiceFaceInfo]
  )

  // initilize scene
  useEffect(() => {
    if (canvas === null || engine === undefined) {
      return
    }

    const { scene, camera } = initScene({
      engine,
      canvas,
      onPick,
    })
    setCamera(camera)
    setNodeGroups(groupNodes(scene))

    engine.runRenderLoop(() => {
      scene.render()
      if (fpsElementRef.current) {
        fpsElementRef.current.innerHTML = engine.getFps().toFixed()
      }
    })
    let mounted = true
    initDice({ scene, diceTheme }).then(() => {
      if (!mounted) {
        return
      }
      setNodeGroups(groupNodes(scene))
    })
    // scene.debugLayer.show()
    Inspector.Show(scene, {})
    return () => {
      mounted = false
      setCamera(undefined)
      camera.dispose()
      scene.dispose()
      engine.stopRenderLoop()
    }
  }, [engine, canvas, diceTheme, onPick])

  const canvasWidth = 768
  const canvasHeight = 768
  return (
    <div style={{ height: "100vh", width: "100vw" }}>
      <div style={{ display: "flex", gap: "8px" }}>
        <div style={{ width: "40px" }} ref={fpsElementRef}></div>
      </div>
      <DiceThemeSelector
        value={diceTheme}
        onChange={(value) => {
          setDiceTheme(value)
        }}
      />
      <DiceFaceInfoView info={diceFaceInfo} />
      <div style={{ height: "4px" }} />
      <div
        style={{
          display: "flex",
          gap: "8px",
          minHeight: "0",
          maxHeight: "100%",
        }}
      >
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
        <MeshTables groups={nodeGroups} camera={camera} />
      </div>
    </div>
  )
}
