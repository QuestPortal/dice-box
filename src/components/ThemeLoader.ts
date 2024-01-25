import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial"
import { Texture } from "@babylonjs/core/Materials/Textures/texture"
import { CustomMaterial } from "@babylonjs/materials/custom/customMaterial"
import * as BABYLON from "@babylonjs/core"

type MaterialConfig = {
  bumpLevel?: number
  bumpTexture?: string
  diffuseLevel?: number
  diffuseTexture?: string
  specularPower?: number
  specularTexture?: string
}

type ThemeConfigColor = {
  type: "color"
  basePath: string
  materials: { light: MaterialConfig; dark: MaterialConfig }
  theme: string
}

type ThemeConfigStandard = {
  type: "standard"
  basePath: string
  material: MaterialConfig
  theme: string
}

type ThemeConfigGLTF = {
  type: "glft"
  basePath: string
  materialFilePath: string
  theme: string
}

type ThemeConfig = ThemeConfigColor | ThemeConfigStandard | ThemeConfigGLTF

class ThemeLoader {
  scene: BABYLON.Scene

  constructor({ scene }: { scene: BABYLON.Scene }) {
    this.scene = scene
  }

  async loadStandardMaterial({
    theme,
    basePath,
    material: matConfig,
  }: ThemeConfigStandard) {
    const diceMaterial = new StandardMaterial(theme, this.scene)
    if (matConfig.diffuseTexture) {
      const texture = await this.getTexture("diffuse", basePath, matConfig)
      diceMaterial.diffuseTexture = texture
    }
    if (matConfig.bumpTexture) {
      diceMaterial.bumpTexture = await this.getTexture(
        "bump",
        basePath,
        matConfig
      )
    }
    if (matConfig.specularTexture) {
      diceMaterial.specularTexture = await this.getTexture(
        "specular",
        basePath,
        matConfig
      )
      if (matConfig.specularPower) {
        diceMaterial.specularPower = matConfig.specularPower
      }
    }
    diceMaterial.allowShaderHotSwapping = false
    return diceMaterial
  }

  async _loadColorMaterial(
    theme: string,
    mode: "dark" | "light",
    basePath: string,
    matConfig: MaterialConfig
  ) {
    const mat = new CustomMaterial(`${theme}_${mode}`, this.scene)
    if (matConfig.diffuseTexture) {
      mat.diffuseTexture = await this.getTexture("diffuse", basePath, matConfig)
    }
    if (matConfig.bumpTexture) {
      mat.bumpTexture = await this.getTexture("bump", basePath, matConfig)
    }
    if (matConfig.specularTexture) {
      mat.specularTexture = await this.getTexture(
        "specular",
        basePath,
        matConfig
      )
    }

    mat.allowShaderHotSwapping = false

    // the magic that allows for the material color to be changed on instances
    mat.Vertex_Definitions(`
      attribute vec3 customColor;
      varying vec3 vColor;
    `).Vertex_MainEnd(`
      vColor = customColor;
    `).Fragment_Definitions(`
      varying vec3 vColor;
    `).Fragment_Custom_Diffuse(`
      baseColor.rgb = mix(vColor.rgb, baseColor.rgb, baseColor.a);
    `)

    mat.AddAttribute("customColor")
  }

  async loadColorMaterial({ theme, basePath, materials }: ThemeConfigColor) {
    await this._loadColorMaterial(theme, "light", basePath, materials.light)
    await this._loadColorMaterial(theme, "dark", basePath, materials.dark)
  }

  async getTexture(
    type: "diffuse" | "bump" | "specular",
    basePath: string,
    matConfig: MaterialConfig
  ): Promise<Texture> {
    let texture: Texture
    switch (type) {
      case "diffuse": {
        texture = await this.importTextureAsync(
          `${basePath}/${matConfig.diffuseTexture}`
        )
        if (matConfig.diffuseLevel) {
          texture.level = matConfig.diffuseLevel
        }
        break
      }
      case "bump": {
        texture = await this.importTextureAsync(
          `${basePath}/${matConfig.bumpTexture}`
        )
        if (matConfig.bumpLevel) {
          texture.level = matConfig.bumpLevel
        }
        break
      }
      case "specular":
        texture = await this.importTextureAsync(
          `${basePath}/${matConfig.specularTexture}`
        )
        break
      default:
        throw new Error(`Texture type: ${type} is not supported`)
    }
    return texture
  }

  async loadGLTFMaterial(config: ThemeConfigGLTF) {
    console.log(config)
    const data = await BABYLON.SceneLoader.ImportMeshAsync(
      undefined,
      config.basePath + "/",
      config.materialFilePath,
      this.scene
    )

    for (const mesh of data.meshes) {
      mesh.isVisible = false
      mesh.setEnabled(false)
    }
    const materials = data.meshes
      .map((mesh) => mesh.material)
      .filter((m): m is BABYLON.Material => Boolean(m))
    if (materials.length !== 1) {
      throw new Error(
        `Error loading glft material. Expected 1 material, got ${materials.length}`
      )
    }
    const material = materials[0]
    material.name = config.theme

    return materials
  }

  async importTextureAsync(url: string) {
    return new Promise<Texture>((resolve, reject) => {
      const texture: Texture = new Texture(
        url, // url: Nullable<string>
        this.scene, // sceneOrEngine: Nullable<Scene | ThinEngine>
        undefined, // noMipmapOrOptions?: boolean | ITextureCreationOptions
        false, // invertY?: boolean
        undefined, // samplingMode?: number
        () => resolve(texture), // onLoad?: Nullable<() => void>
        (error) => {
          console.error("failed to load texture", error)
          reject(`Unable to load texture '${url}'`) // onError?: Nullable<(message?: string
        }
      )
    })
  }

  async load(config: ThemeConfig) {
    if (config.type === "color") {
      await this.loadColorMaterial(config)
    } else if (config.type === "standard") {
      await this.loadStandardMaterial(config)
    } else if (config.type === "glft") {
      console.log("loading binary material", config)
      await this.loadGLTFMaterial(config)
    } else {
      // @ts-ignore
      console.error(`theme type: ${config.type} not supported`)
    }
  }
}

export default ThemeLoader
