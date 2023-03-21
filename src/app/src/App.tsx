import React from "react";
import "./App.css";
import { Layout } from "antd";
import { StyloCompiler } from "./compiler/StyloCompiler";
import CodeEditor from "./CodeEditor";
import ZoomableCanvas from "./ZoomableCanvas";

const { Content, Sider } = Layout;

const layoutStyle = {  
  height: "100vh",
}
const siderStyle = {
  width: "600px"
}

const compiler = new StyloCompiler("../../libs/std.stylo");

const App = () => {
  const [html, setHtml] = React.useState<string>("");
  const [error, setError] = React.useState<string>("");


  const handleCodeChange = (newValue: string) => {
    try {
      const compiled = compiler.compile(newValue);
      console.log(compiled);
      if (compiled) {
        setHtml(compiled);
      }

    } catch(e: any) {
      console.log(e);
      setError(e.message);
    }
  }

  return (
    <Layout style={layoutStyle}>
      <Sider style={siderStyle}>
        H
        <CodeEditor onChange={handleCodeChange}/>
      </Sider>
      <Content>
        G
        <div>{error}</div>
        <ZoomableCanvas source={html} />
      </Content>
    </Layout>
  );
};

export default App;
