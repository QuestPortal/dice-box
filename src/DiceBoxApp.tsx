import { useEffect, useState, useRef } from "react"
import { Inspector } from "@babylonjs/inspector"

import DiceBox from "./WorldFacade"

const canvasId = "dicebox-canvas"

const config = {
  assetPath: "/assets/dice-box/",
  theme: "marble",
  themeColor: "#9610E9",
  meshFile: "models/default/default.glb",
  angularDamping: 0.2,
  linearDamping: 0.5,
  delay: 2,
  scale: 6,
  gravity: 3,
  mass: 1,
  friction: 0.5,
  restitution: 0.3,
  settleTimeout: 5000,
  startingHeight: 12,
  spinForce: 6,
  throwForce: 4,
  ttl: 2000,
  fadeOutDuration: 500,
  offscreen: false,
}

export const DiceBoxApp = () => {
  const rootElementRef = useRef<HTMLDivElement | null>(null)
  const [canvasElement, setCanvasElement] = useState<HTMLCanvasElement | null>(
    null
  )
  const [status, setStatus] = useState("loading")
  const [ready, setReady] = useState(false)
  const [dicebox, setDicebox] = useState<DiceBox>()
  const [result, setResult] = useState<string>("")
  const [rollString, setRollString] = useState<string>("1d20")

  useEffect(() => {
    if (canvasElement === null) {
      return
    }
    try {
      setStatus("creating")
      const dicebox = new DiceBox(`#${canvasId}`, config)

      setDicebox(dicebox)
      setStatus("initializing")
      dicebox
        .init()
        .then(() => {
          setStatus("initialized")
          setReady(true)
          const scene = dicebox.getScene()
          if (rootElementRef.current === null) {
            console.error("rootElementRef.current is null")
            return
          }
          Inspector.Show(scene, { globalRoot: rootElementRef.current })
        })
        .catch((error) => {
          console.error(error)
          setStatus("failed to initialize")
        })
    } catch (error) {
      setStatus("failed to create")
      console.error(error)
      return
    }
  }, [canvasElement])

  return (
    <div
      ref={rootElementRef}
      style={{
        width: "100vw",
        height: "100vh",
        marginRight: "10px",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "left",
          paddingLeft: "10px",
        }}
      >
        <div>status:{status}</div>
        <input
          style={{ width: "250px" }}
          value={rollString}
          onChange={(e) => setRollString(e.target.value)}
        />
        <button
          disabled={!ready}
          style={{
            width: "fit-content",
          }}
          onClick={() => {
            if (dicebox === undefined) {
              return
            }
            dicebox.roll(rollString.split(",")).then((result) => {
              setResult(result.map((r) => r.value).join(","))
            })
          }}
        >
          Roll
        </button>
        <div>result:{result}</div>
      </div>
      <canvas
        ref={setCanvasElement}
        id={canvasId}
        width="768"
        height="768"
        style={{
          border: "1px solid black",
          marginLeft: "10px",
          width: "768px",
          height: "768px",
        }}
      />
    </div>
  )
}
