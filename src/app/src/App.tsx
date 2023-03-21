import React from "react";
import "./App.css";
import { StyloCompiler } from "./compiler/StyloCompiler";
import CodeEditor from "./CodeEditor";
import ZoomableCanvas from "./ZoomableCanvas";

const layoutStyle = {  
  height: "100vh",
  display: 'grid',
  gridTemplateColumns: '600px 1fr'
}

const compiler = new StyloCompiler();

const App = () => {
  const [html, setHtml] = React.useState<string>("");


  const handleCodeChange = (newValue: string) => {
    try {
      const compiled = compiler.compile(newValue);
      console.log(compiled);
      if (compiled) {
        setHtml(compiled);
      }

    } catch(e: any) {
      console.log('error', e);
    }
  }

  return (
    <div style={layoutStyle}>
      <CodeEditor onChange={handleCodeChange}/>
      <ZoomableCanvas html={html} />
    </div>
  );
};

export default App;
