import React from "react";
import "./App.css";
import { StyloCompiler } from "./compiler/StyloCompiler";
import CodeEditor from "./CodeEditor";
import ZoomableCanvas from "./ZoomableCanvas";
import { RenderResult } from "./compiler/StyloRenderer";

const layoutStyle = {
  height: "100vh",
  display: "grid",
  gridTemplateColumns: "800px 1fr",
};

const compiler = new StyloCompiler();

const App = () => {
  const [render, setRender] = React.useState<RenderResult>({
    style: "",
    components: [],
  });

  const handleCodeChange = (newValue: string) => {
    try {
      const renderResult = compiler.compile(newValue);
      if (renderResult) {
        setRender(renderResult);
      }
    } catch (e: any) {
      console.log("error", e);
    }
  };

  return (
    <div style={layoutStyle}>
      <CodeEditor onChange={handleCodeChange} />
      <ZoomableCanvas render={render} />
    </div>
  );
};

export default App;
