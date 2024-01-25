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

type ThemeConfig =
  | {
      type: "color"
      basePath: string
      materials: { light: MaterialConfig; dark: MaterialConfig }
      theme: string
    }
  | {
      type: "standard"
      basePath: string
      material: MaterialConfig
      theme: string
    }

class ThemeLoader {
  scene: BABYLON.Scene

  constructor({ scene }: { scene: BABYLON.Scene }) {
    this.scene = scene
  }

  async loadStandardMaterial(
    name: string,
    basePath: string,
    matConfig: MaterialConfig
  ) {
    const diceMaterial = new StandardMaterial(name, this.scene)
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

  async loadColorMaterial(
    name: string,
    basePath: string,
    matConfig: { light: MaterialConfig; dark: MaterialConfig }
  ) {
    await this._loadColorMaterial(name, "light", basePath, matConfig.light)
    await this._loadColorMaterial(name, "dark", basePath, matConfig.dark)
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
      await this.loadColorMaterial(
        config.theme,
        config.basePath,
        config.materials
      )
    } else if (config.type === "standard") {
      await this.loadStandardMaterial(
        config.theme,
        config.basePath,
        config.material
      )
    } else {
      // @ts-ignore
      console.error(`theme type: ${config.type} not supported`)
    }
  }
}

export default ThemeLoader
