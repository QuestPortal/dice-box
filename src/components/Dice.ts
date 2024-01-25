import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader"
import { Vector3 } from "@babylonjs/core/Maths/math.vector"
import { Color3 } from "@babylonjs/core/Maths/math.color"
import * as BABYLON from "@babylonjs/core"
import { Ray } from "@babylonjs/core/Culling/ray"
// import { RayHelper } from '@babylonjs/core/Debug';
import "../helpers/babylonFileLoader"
import "@babylonjs/core/Meshes/instancedMesh"

import { deepCopy } from "../helpers"
import "@babylonjs/loaders/glTF/2.0/glTFLoader"

const defaultOptions = {
  assetPath: "",
  enableShadows: false,
  groupId: null,
  id: null,
  lights: [],
  rollId: null,
  scene: null,
}

// TODO: this would probably be better as a factory pattern
class Dice {
  value = 0
  asleep = false

  config: any = {}
  id: any
  dieType: string
  comboKey: string
  scene: BABYLON.Scene
  mesh: BABYLON.InstancedMesh | null = null

  constructor(options: any, scene: BABYLON.Scene) {
    this.config = { ...defaultOptions, ...options }
    this.id = this.config.id !== undefined ? this.config.id : Date.now()
    this.dieType = `d${this.config.sides}`
    this.comboKey = `${this.config.theme}_${this.dieType}`
    this.scene = scene
    this.createInstance()
  }

  createInstance() {
    // piece together the name of the die we want to instance
    const targetDie = `${this.config.meshName}_${this.dieType}_${this.config.theme}${this.config.colorSuffix}`
    // create a new unique name for this instance
    const instanceName = `${targetDie}-instance-${this.id}`

    // find the die mesh in the scene
    const dieMesh = this.scene.getMeshByName(targetDie)
    if (dieMesh === null) {
      throw new Error(`die mesh not found: ${targetDie}`)
    }
    if (!(dieMesh instanceof BABYLON.Mesh)) {
      throw new Error(`die mesh not a Mesh: ${targetDie}`)
    }

    // create an instance of the mesh
    const dieInstance = dieMesh.createInstance(instanceName)

    if (this.config.colorSuffix.length > 0) {
      const color = Color3.FromHexString(this.config.themeColor)
      dieInstance.instancedBuffers.customColor = color
    }

    // start the instance under the floor, out of camera view
    dieInstance.position.y = -100
    dieInstance.scaling = new Vector3(
      this.config.scale,
      this.config.scale,
      this.config.scale
    )

    if (this.config.enableShadows) {
      // let's keep this simple for now since we know there's only one directional light
      this.config.lights["directional"].shadowGenerator.addShadowCaster(
        dieInstance
      )
      // for (const key in this.config.lights) {
      //   if(key !== 'hemispheric' ) {
      //     this.config.lights[key].shadowGenerator.addShadowCaster(dieInstance)
      //   }
      // }
    }

    // attach the instance to the class object
    this.mesh = dieInstance
  }

  // TODO: add themeOptions for colored materials, must ensure theme and themeOptions are unique somehow
  static async loadDie(options: any, scene: BABYLON.Scene) {
    const { sides, theme = "default", meshName, colorSuffix } = options

    // create a key for this die type and theme for caching and instance creation
    const dieMeshName = meshName + "_d" + sides
    const dieMaterialName = dieMeshName + "_" + theme + colorSuffix
    let die = scene.getMeshByName(dieMaterialName)
    if (!die) {
      const mesh = scene.getMeshByName(dieMeshName)
      if (mesh === null) {
        throw new Error("die mesh not found: " + dieMeshName)
      }
      if (!(mesh instanceof BABYLON.Mesh)) {
        throw new Error("die mesh not a Mesh: " + dieMeshName)
      }
      die = mesh.clone(dieMaterialName)
    }

    if (!die.material) {
      die.material = scene.getMaterialByName(theme + colorSuffix)
      if (colorSuffix.length > 0) {
        if (!(die instanceof BABYLON.Mesh)) {
          throw new Error("die not a Mesh: " + dieMeshName)
        }
        die.registerInstancedBuffer("customColor", 3)
      }
      // die.material.freeze()
    }

    return options
  }

  static async loadModelMetadata(options: any) {
    const metadataPath =
      "http://localhost:5173/assets/dice-box/exports/models/master/metadata.json"
    const metadata = await fetch(metadataPath).then((resp) => {
      if (resp.ok) {
        const contentType = resp.headers.get("content-type")
        if (contentType && contentType.indexOf("application/json") !== -1) {
          return resp.json()
        } else if (resp.type && resp.type === "basic") {
          return resp.json()
        } else {
          // return resp
          throw new Error(
            `Incorrect contentType: ${contentType}. Expected "application/json" or "basic"`
          )
        }
      } else {
        throw new Error(
          `Unable to load mesh metadata file: '${metadataPath}'. Request rejected with status ${resp.status}: ${resp.statusText}`
        )
      }
    })
    return metadata
  }

  // load all the dice models
  static async loadModels(options: any, scene: BABYLON.Scene) {
    // can we get scene without passing it in?
    const {
      meshFilePath,
      meshName,
      meshFile,
      scale,
      d4FaceDown = true,
      assetPath,
    } = options

    const modelData: any = await this.loadModelMetadata(options)
    const data = await SceneLoader.ImportMeshAsync(
      null,
      meshFilePath,
      undefined,
      scene
    )

    let has_d100 = false
    let has_d10 = false
    let root = undefined
    const colliders = []
    for (const mesh of data.meshes) {
      if (!(mesh instanceof BABYLON.Mesh)) {
        throw new Error("mesh not a Mesh: " + meshName)
      }
      if (mesh.name === "__root__") {
        root = mesh
        continue
      }
      if (mesh.parent?.name === "__root__") {
        // detach all meshes from the root node
        mesh.parent = null
      }
      if (mesh.name.startsWith("d")) {
        // TODO: remove from the glib file
        mesh.material = null
      }

      // shrink the colliders
      if (mesh.name.includes("collider")) {
        mesh.scaling = new Vector3(0.9, 0.9, 0.9)

        // minimal data needed for ammo
        const positions = mesh.getVerticesData("position")
        const scaling = mesh.scaling
        colliders.push({
          positions: positions,
          name: mesh.name,
          scaling: [scaling.x, scaling.y, scaling.z],
        })
      }

      // check if d100 is available as a mesh - otherwise we'll clone a d10
      if (!has_d100) {
        has_d100 = mesh.name === "d100"
      }
      if (!has_d10) {
        has_d10 = mesh.name === "d10"
      }
      mesh.setEnabled(false)
      mesh.freezeNormals()
      mesh.freezeWorldMatrix()
      mesh.isPickable = false
      mesh.doNotSyncBoundingInfo = true
      // prefix all the meshes ids from this file with the file name so we can find them later e.g.: 'default-dice_d10' and 'default-dice_d10_collider'
      // model.id = meshName + '_' + model.id
      mesh.name = meshName + "_" + mesh.name
    }

    if (root) {
      // all meshes have been removed from the root node, so we can remove it
      root.dispose()
    }

    if (!has_d100 && has_d10) {
      // console.log("create a d100 from a d10")
      const d10Name = meshName + "_d10"
      const d10Mesh = scene.getMeshByName(d10Name) as BABYLON.Mesh
      d10Mesh.clone?.(meshName + "_d100")

      const d10ColliderMesh = scene.getMeshByName(
        meshName + "_d10_collider"
      ) as BABYLON.Mesh
      d10ColliderMesh.clone(meshName + "_d100_collider")

      if (modelData.colliderFaceMap) {
        modelData.colliderFaceMap["d100"] = deepCopy(
          modelData.colliderFaceMap["d10"]
        )
        Object.values(modelData.colliderFaceMap["d100"]).forEach((val, i) => {
          modelData.colliderFaceMap["d100"][i] =
            (val as number) * (val === 10 ? 0 : 10)
        })
      }
    }

    // save colliderFaceMap to scene - couldn't find a better place to stash this
    if (!modelData.colliderFaceMap) {
      throw new Error(
        `'colliderFaceMap' data not found in ${meshFilePath}. Without the colliderFaceMap data dice values can not be resolved.`
      )
    }

    // TODO: FIND A BETTER PLACE TO STORE THIS DATA
    // @ts-ignore
    scene.themeData[meshName] = {}
    // @ts-ignore
    scene.themeData[meshName].colliderFaceMap = modelData.colliderFaceMap
    // @ts-ignore
    scene.themeData[meshName].d4FaceDown = d4FaceDown

    return colliders
  }

  updateConfig(option: any) {
    this.config = { ...this.config, ...option }
  }

  static ray = new Ray(Vector3.Zero(), Vector3.Zero(), 1)
  static vector3 = Vector3.Zero()

  static setVector3(x: number, y: number, z: number) {
    return Dice.vector3.set(x, y, z)
  }

  static getVector3() {
    return Dice.vector3
  }

  static async getRollResult(die: any, scene: BABYLON.Scene) {
    // TODO: Why a function in a function?? fix this
    const getDieRoll = (d = die) =>
      new Promise((resolve, reject) => {
        const meshName = die.config.parentMesh || die.config.meshName

        // @ts-ignore
        const meshFaceIds = scene.themeData[meshName].colliderFaceMap
        // @ts-ignore
        const d4FaceDown = scene.themeData[meshName].d4FaceDown

        if (!meshFaceIds[d.dieType]) {
          throw new Error(`No colliderFaceMap data for ${d.dieType}`)
        }

        // const dieHitbox = d.config.scene.getMeshByName(`${d.dieType}_collider`).createInstance(`${d.dieType}-hitbox-${d.id}`)
        const dieHitbox = (
          scene.getMeshByName(
            `${meshName}_${d.dieType}_collider`
          ) as BABYLON.Mesh
        ).createInstance(`${meshName}_${d.dieType}-hitbox-${d.id}`)
        dieHitbox.isPickable = true
        dieHitbox.isVisible = true
        dieHitbox.setEnabled(true)
        dieHitbox.position = d.mesh.position
        dieHitbox.rotationQuaternion = d.mesh.rotationQuaternion

        let vector = Dice.setVector3(0, 1, 0)
        if (d.dieType === "d4" && d4FaceDown) {
          vector = Dice.setVector3(0, -1, 0)
        }

        Dice.ray.direction = vector
        Dice.ray.origin = die.mesh.position

        const picked = scene.pickWithRay(Dice.ray)
        if (picked === null || picked === undefined) {
          throw new Error("pickWithRay failed")
        }

        dieHitbox.dispose()

        // let rayHelper = new RayHelper(Dice.ray)
        // rayHelper.show(d.config.scene)
        d.value = meshFaceIds[d.dieType][picked.faceId]
        if (d.value === undefined) {
          throw new Error(
            `colliderFaceMap Error: No value found for ${d.dieType} mesh face ${picked.faceId}`
          )
        }

        return resolve(d.value)
      }).catch((error) => console.error(error))

    if (!die.mesh) {
      return die.value
    }

    return await getDieRoll()
  }
}

export default Dice
