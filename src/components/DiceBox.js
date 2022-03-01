import { Color3 } from '@babylonjs/core/Maths/math.color'
import { BoxBuilder } from '@babylonjs/core/Meshes/Builders/boxBuilder'
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import { TransformNode } from '@babylonjs/core/Meshes/transformNode'
import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { ShadowOnlyMaterial } from '@babylonjs/materials/shadowOnly/shadowOnlyMaterial'

const defaultOptions = {
  size: 9.5,
  aspect: 300 / 150,
  enableDebugging: false,
  enableShadows: true,
}

class DiceBox{
	constructor(options){
		this.config = {...defaultOptions, ...options}
		this.create()
	}
	create(options){
		// remove any previously existing boxes
		this.destroy()
		// extend config with options on create
		Object.assign(this.config,options)
		const { aspect, enableDebugging = true, enableShadows } = this.config
		const wallHeight = 30
		let boxMaterial

		this.box = new TransformNode("diceBox");

		if(enableDebugging) {
			boxMaterial = new StandardMaterial("diceBox_material")
			boxMaterial.alpha = .7
			boxMaterial.diffuseColor = new Color3(1, 1, 0);
		}
		else {
			// if(enableShadows) {
				boxMaterial = new ShadowOnlyMaterial('shadowOnly',this.config.scene)
				boxMaterial.alpha = .5
				// boxMaterial.diffuseColor = new Color3(1, 1, 1)
				// boxMaterial.activeLight = lights.directional
			// } 
		}

		// Bottom of the Box
		const ground = BoxBuilder.CreateBox("ground",{
			width: this.config.size, 
			height: 1,
			depth: this.config.size
		}, this.config.scene)
		ground.scaling = new Vector3(aspect, 1, 1)
		ground.material = boxMaterial
		ground.receiveShadows = true
		ground.setParent(this.box)

		// North Wall
		const wallTop = BoxBuilder.CreateBox("wallTop",{
			width: this.config.size,
			height: wallHeight,
			depth: 1
		}, this.config.scene)
		wallTop.position.y = wallHeight / 2
		wallTop.position.z = this.config.size / -2
		wallTop.scaling = new Vector3(aspect, 1, 1)
		wallTop.material = boxMaterial
		// wallTop.receiveShadows = true
		wallTop.setParent(this.box)

		// Right Wall
		const wallRight = BoxBuilder.CreateBox("wallRight",{
			width: 1, 
			height: wallHeight,
			depth: this.config.size
		}, this.config.scene )
		wallRight.position.x = this.config.size * aspect / 2
		wallRight.position.y = wallHeight / 2
		wallRight.material = boxMaterial
		// wallRight.receiveShadows = true
		wallRight.setParent(this.box)

		// South Wall
		const wallBottom = BoxBuilder.CreateBox("wallBottom",{
			width: this.config.size, 
			height: wallHeight,
			depth: 1
		}, this.config.scene)
		wallBottom.position.y = wallHeight / 2
		wallBottom.position.z = this.config.size / 2
		wallBottom.scaling = new Vector3(aspect, 1, 1)
		wallBottom.material = boxMaterial
		// wallBottom.receiveShadows = true
		wallBottom.setParent(this.box)

		// Left Wall
		const wallLeft = BoxBuilder.CreateBox("wallLeft",{
			width: 1, 
			height: wallHeight,
			depth: this.config.size
		}, this.config.scene)
		wallLeft.position.x = this.config.size * aspect / -2
		wallLeft.position.y = wallHeight / 2
		wallLeft.material = boxMaterial
		// wallLeft.receiveShadows = true
		wallLeft.setParent(this.box)
	}
	destroy(){
		if(this.box) {
			this.box.dispose()
		}
	}
}

export default DiceBox