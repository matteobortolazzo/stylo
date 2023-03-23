import React, { FC, useEffect } from 'react';
import MonacoEditor from 'react-monaco-editor';
import * as monaco from 'monaco-editor';

const registerCustomLanguage = () => {
  monaco.languages.register({ id: 'stylo' });

  monaco.languages.setMonarchTokensProvider('stylo', {
    tokenizer: {
      root: [
        [/param|class|component|element|style|slot|render/, 'keyword'],
        [/\b[A-Z][a-zA-Z0-9]*[A-Z][a-zA-Z0-9]*\b/, 'type.identifier'],
        [/\b[a-z][a-zA-Z0-9-]*\b/, 'classname'],
        [/\b[a-z][a-zA-Z0-9]+\b/, 'param'],
        [/(['"])[^']*?\1/, 'string'],
        [/(['"])[^"]*?\1/, 'string'],
        [/[{}()]/, 'delimiter'],
        [/:/, 'delimiter.colon'],
        [/;/, 'delimiter.semicolon'],
        [/\./, 'delimiter.dot'],
        [/=/, 'delimiter.equals'],
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