import React from "react";
import "./App.css";
import { StyloCompiler } from "./compiler/StyloCompiler";
import CodeEditor from "./CodeEditor";
import ZoomableCanvas from "./ZoomableCanvas";
import { RenderResult } from "./compiler/StyloRenderer";
import { CodePosition } from "./compiler/StyloParser";

const layoutStyle = {
  height: "100vh",
  display: "grid",
  gridTemplateColumns: "800px 1fr",
};

const compiler = new StyloCompiler();

const App = () => {
  const [highlight, setHighlight] = React.useState<CodePosition | undefined>(undefined);
  const [render, setRender] = React.useState<RenderResult>({
    style: "",
    renders: [],
    components: {},
  });

  const handleCodeChange = async (newValue: string) => {
    try {
      const renderResult = await compiler.compile(newValue);
      if (renderResult) {
        setRender(renderResult);
      }
    } catch (e: any) {
      console.log("error", e);
    }
  };

  const mouseEnter = (component: string) => {
    const componentInfo = render.components[component];
    if (componentInfo) {
      console.log(component, componentInfo);
      setHighlight(componentInfo)
    }
  };

  return (
    <div style={layoutStyle}>
      <CodeEditor onChange={handleCodeChange} highlight={highlight} />
      <ZoomableCanvas render={render} mouseEnter={mouseEnter} />
    </div>
  );
};

export default App;
