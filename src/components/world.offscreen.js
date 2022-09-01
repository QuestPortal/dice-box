import worldWorker from './offscreenCanvas.worker?worker&inline' // using vits.js worker import - this will be compiled away
import { createUUID } from '../helpers'

class WorldOffScreen {
	initialized = false
	offscreenWorkerInit = false
	themeLoadedInit = false
	pendingThemePromises = []
	#offscreenCanvas
	#OffscreenWorker
	onInitComplete = () => {} // init callback
	onRollResult = () => {} // individual die callback
	onRollComplete = () => {} // roll group callback

	constructor(options){

		// transfer control offscreen
		this.#offscreenCanvas = options.canvas.transferControlToOffscreen()

		// initialize 3D World in which BabylonJS runs
		this.#OffscreenWorker = new worldWorker()
		// need to initialize the web worker and get confirmation that initialization is complete before other scripts can run
		// set a property on the worker to a promise that is resolve when the proper message is returned from the worker
		this.#OffscreenWorker.init = new Promise((resolve, reject) => {
			this.offscreenWorkerInit = resolve
		})

		this.initialized = this.#initScene(options)
	}

	// initialize the babylon scene
	async #initScene(config) {
		// initalize the offscreen worker
		this.#OffscreenWorker.postMessage({
			action: "init",
			canvas: this.#offscreenCanvas,
			width: config.canvas.clientWidth,
			height: config.canvas.clientHeight,
			options: config.options,
		}, [this.#offscreenCanvas])

		// handle messages from offscreen BabylonJS World
		this.#OffscreenWorker.onmessage = (e) => {
			switch( e.data.action ) {
				case "init-complete":
					this.offscreenWorkerInit() //fulfill promise so other things can run
					break;
				case "theme-loaded":
					this.pendingThemePromises[e.data.id]()
					break;
				case 'roll-result':
					this.onRollResult(e.data.die)
					break;
				case 'roll-complete':
					this.onRollComplete()
					break;
				case 'die-removed':
					this.onDieRemoved(e.data.rollId)
					break;
			}
		}
		await Promise.all([this.#OffscreenWorker.init])

		this.onInitComplete(true)

		return true
	}

	connect(port){
		// Setup the connection: Port 1 is for this.#OffscreenWorker
		this.#OffscreenWorker.postMessage({
			action : "connect",
			port
		},[ port ])
	}

	updateConfig(options){
		this.#OffscreenWorker.postMessage({action: "updateConfig", options});
	}

	resize(options){
		this.#OffscreenWorker.postMessage({action: "resize", options});
	}

	async loadTheme(theme) {
		const id = createUUID()

		return new Promise((resolve, reject) => {
			this.#OffscreenWorker.postMessage({action: "loadTheme", id, theme})
			// this.themeLoadedInit = resolve
			this.pendingThemePromises[id] = resolve
		})
	}

	clear(){
		this.#OffscreenWorker.postMessage({action: "clearDice"})
	}

	add(options){
		this.#OffscreenWorker.postMessage({action: "addDie", options})
	}

	remove(options){
		// remove the die from the render
		this.#OffscreenWorker.postMessage({action: "removeDie", options})
	}
}

export default WorldOffScreen