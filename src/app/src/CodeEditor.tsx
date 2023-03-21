import React, { FC, useEffect } from 'react';
import MonacoEditor from 'react-monaco-editor';
import * as monaco from 'monaco-editor';

const registerCustomLanguage = () => {
  monaco.languages.register({ id: 'stylo' });

  monaco.languages.setMonarchTokensProvider('myCustomLanguage', {
    tokenizer: {
      root: [
        // Define your custom grammar rules here
        [/(\w+)/, 'variable'],
      ],
    },
  });
};

type CodeEditorProps = {
  onChange: (newValue: string) => void;
};


const CodeEditor: FC<CodeEditorProps> = ({ onChange }) => {
  useEffect(() => {
    registerCustomLanguage();
  }, []);

  const handleEditorChange = (newValue: string, e: any) => {
    onChange(newValue);
  };

  return (
    <MonacoEditor
      width="600"
      height="100vh"
      language="stylo"
      theme="vs-dark"
      value="// Your code here"
      onChange={handleEditorChange}
    />
  );
};

export default CodeEditor;