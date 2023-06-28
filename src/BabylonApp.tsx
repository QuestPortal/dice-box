import { useState, useEffect } from "react";

import * as BABYLON from "@babylonjs/core";
import { CustomMaterial } from "@babylonjs/materials";

const createEngine = (canvas: HTMLCanvasElement) => {
  return new BABYLON.Engine(canvas, true, {
    preserveDrawingBuffer: true,
    stencil: true,
  });
};

const createScene = (engine: BABYLON.Engine) => {
  const scene = new BABYLON.Scene(engine);
  scene.clearColor = new BABYLON.Color4(0, 0, 0, 0);

  const optimizationSettings =
    BABYLON.SceneOptimizerOptions.LowDegradationAllowed(60);

  // remove merge optimizer
  optimizationSettings.optimizations =
    optimizationSettings.optimizations.splice(1);

  BABYLON.SceneOptimizer.OptimizeAsync(scene, optimizationSettings);

  scene.onPointerObservable.add((pointerInfo) => {
    switch (pointerInfo.type) {
      case BABYLON.PointerEventTypes.POINTERDOWN:
        const picked = scene.pick(scene.pointerX, scene.pointerY);
        console.log("FACEID:", picked?.faceId);
        break;
      case BABYLON.PointerEventTypes.POINTERUP:
        break;
      case BABYLON.PointerEventTypes.POINTERMOVE:
        break;
      case BABYLON.PointerEventTypes.POINTERWHEEL:
        break;
      case BABYLON.PointerEventTypes.POINTERPICK:
        break;
      case BABYLON.PointerEventTypes.POINTERTAP:
        break;
      case BABYLON.PointerEventTypes.POINTERDOUBLETAP:
        break;
    }
  });

  return scene;
};

const createCamera = (canvas: HTMLCanvasElement, scene: BABYLON.Scene) => {
  // This creates and positions a free camera (non-mesh)
  const camera = new BABYLON.ArcRotateCamera(
    "Camera",
    0,
    0,
    10,
    new BABYLON.Vector3(0, 0, 0),
    scene
  );

  // This targets the camera to scene origin
  camera.setTarget(BABYLON.Vector3.Zero());

  // This attaches the camera to the canvas
  camera.attachControl(canvas, true, true);

  camera.zoomToMouseLocation = true;
  camera.wheelDeltaPercentage = 0.01;
  camera.minZ = 0.1;

  return camera;
};

const createLights = ({
  intensity,
  scene,
}: {
  intensity: number;
  scene: BABYLON.Scene;
}) => {
  const d_light = new BABYLON.DirectionalLight(
    "DirectionalLight",
    new BABYLON.Vector3(-0.3, -1, 0.4),
    scene
  );
  d_light.position = new BABYLON.Vector3(-50, 65, -50);
  d_light.intensity = 0.65 * intensity;

  const h_light = new BABYLON.HemisphericLight(
    "HemisphericLight",
    new BABYLON.Vector3(1, 1, 0),
    scene
  );
  h_light.intensity = 0.4 * intensity;

  return { directional: d_light, hemispheric: h_light };
};

const createObjects = (scene: BABYLON.Scene) => {
  var sphere = BABYLON.MeshBuilder.CreateSphere(
    "sphere",
    { diameter: 2, segments: 32 },
    scene
  );
  // Move the sphere upward 1/2 its height
  sphere.position.y = 1;

  var ground = BABYLON.MeshBuilder.CreateGround(
    "ground",
    { width: 6, height: 6 },
    scene
  );
  return { sphere, ground };
};

const createDebugObjects = (scene: BABYLON.Scene) => {
  const axes = new BABYLON.AxesViewer(scene, 1);
  return { axes };
};

const loadTexture = async (
  url: string,
  scene: BABYLON.Scene
): Promise<BABYLON.Texture> => {
  return new Promise<BABYLON.Texture>((resolve, reject) => {
    let fileName = url.match(/^(.*\/)(.*)$/);
    const texture: BABYLON.Texture = new BABYLON.Texture(
      url, // url: Nullable<string>
      scene, // sceneOrEngine: Nullable<Scene | ThinEngine>
      undefined, // noMipmapOrOptions?: boolean | ITextureCreationOptions
      true, // invertY?: boolean - WHY?
      undefined, // samplingMode?: number
      () => resolve(texture), // onLoad
      () => reject(`Unable to load texture '${url}'`) // onError
    );
  });
};

const loadDiceMaterial = async (scene: BABYLON.Scene) => {
  const material = new CustomMaterial("dice", scene);
  const diffuseTexture = await loadTexture(
    "assets/dice-box/themes/qp/diffuse.png",
    scene
  );
  console.log("diffuseTexture", diffuseTexture);
  // material.diffuseColor = new BABYLON.Color3(0, 1, 0);
  material.diffuseTexture = diffuseTexture;

  const bumpTexture = await loadTexture(
    "assets/dice-box/themes/qp/normal.png",
    scene
  );
  material.bumpTexture = bumpTexture;

  const specularTexture = await loadTexture(
    "assets/dice-box/themes/qp/specular.png",
    scene
  );
  material.specularTexture = specularTexture;

  // the magic that allows for the material color to be changed on instances
  /*   material.Vertex_Definitions(`
      attribute vec3 customColor;
      varying vec3 vColor;
    `).Vertex_MainEnd(`
      vColor = customColor;
    `).Fragment_Definitions(`
      varying vec3 vColor;A
    `).Fragment_Custom_Diffuse(`
      baseColor.rgb = mix(vColor.rgb, baseColor.rgb, baseColor.a);
    `);

  material.AddAttribute("customColor"); */

  return material;
};

const modelsPath = "http://localhost:5173/assets/dice-box/models/";

const loadMesh = async (
  modelFile: string,
  material: BABYLON.Material,
  scene: BABYLON.Scene
) => {
  const data = await BABYLON.SceneLoader.ImportMeshAsync(
    null,
    modelsPath,
    modelFile,
    scene
  );

  for (const mesh of data.meshes) {
    console.log("mesh.name", mesh.name);
    if (mesh.name.includes("collider")) {
      //mesh.setEnabled(false);
      mesh.position.y = 0.5;
      mesh.setEnabled(true);
      mesh.isPickable = true;
      continue;
    }
    mesh.setEnabled(false);
    console.log(mesh.name, mesh.isEnabled());
    mesh.material = material;
    // mesh.instancedBuffers.customColor = BABYLON.Color3.Random();
  }
};

const init = async (canvas: HTMLCanvasElement) => {
  const engine = createEngine(canvas);
  const scene = createScene(engine);
  const camera = createCamera(canvas, scene);
  const lights = createLights({ intensity: 1, scene });
  //const objects = createObjects(scene);
  //createDebugObjects(scene);

  // await loadMesh("default.json", scene);

  // await loadMesh("new.json", scene);

  const material = await loadDiceMaterial(scene);
  await loadMesh("qp.json", material, scene);

  engine.runRenderLoop(function () {
    scene.render();
  });
  return { engine, scene, camera, lights };
};

export const BabylonApp = () => {
  const [canvasElement, setCanvasElement] = useState<HTMLCanvasElement | null>(
    null
  );

  useEffect(() => {
    if (canvasElement === null) {
      return;
    }
    init(canvasElement);
  });

  return (
    <canvas
      ref={setCanvasElement}
      id={"canvas"}
      width="1000"
      height="1000"
      style={{
        border: "1px solid black",
        width: "1000px",
        height: "1000px",
      }}
    />
  );
};
