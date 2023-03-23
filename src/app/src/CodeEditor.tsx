import React, { FC, useEffect } from "react";
import MonacoEditor from "react-monaco-editor";
import * as monaco from "monaco-editor";

const registerCustomLanguage = () => {
  monaco.languages.register({ id: "stylo" });

  monaco.languages.setMonarchTokensProvider("stylo", {
    componentKeywords: [
      "element",
      "slot",
      "style",
    ],
    operators: ["=", ":"],

    // C# style strings
    escapes: /\\(?:[abfnrtv\\"']|x[0-9A-Fa-f]{1,4}|u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8})/,

    // The main tokenizer for our languages
    tokenizer: {
      root: [
        [/param/, { token: 'keyword', next: '@paramname' }],
        [/class/, { token: 'keyword', next: '@classname' }],
        [/render component/, { token: 'keyword', next: '@componentname' }],
        [/component/, { token: 'keyword', next: '@componentname' }],
        
        // whitespace
        { include: "@whitespace" },
        
        // delimiters and operators
        [/[{}()\\[\\]]/, '@brackets'],

        // delimiter: after number because of .\d floats
        [/[;,.]/, 'delimiter'],

        // strings
        [/"([^"\\]|\\.)*$/, 'string.invalid' ],  // non-teminated string
        [/"/,  { token: 'string.quote', bracket: '@open', next: '@string' } ],
        [/'/,  { token: 'string.quote', bracket: '@open', next: '@string' } ]
      ],

      comment: [
        [/[^\\/*]+/, "comment"],
        [/\/\*/, "comment", "@push"], // nested comment
        ["\\*/", "comment", "@pop"],
        [/[\\/*]/, "comment"],
      ],

      string: [
        [/[^\\"\\']+/, "string"],
        [/@escapes/, "string.escape"],
        [/\\./, "string.escape.invalid"],
        [/"/, { token: "string.quote", bracket: "@close", next: "@pop" }],
        [/'/, { token: "string.quote", bracket: "@close", next: "@pop" }],
      ],

      whitespace: [
        [/[ \t\r\n]+/, "white"],
        [/\/\*/, "comment", "@comment"],
        [/\/\/.*$/, "comment"],
      ],

      paramname: [
        [/[a-z][\w$-]*/, { token: 'variable.name', next: '@popall' }],
      ],
      
      classname: [
        [/[a-z][\w$-]*/, { token: 'variable.name', next: '@css_block', nextEmbedded: 'text/css' }],
      ],

      css_block: [
        [/{/, 'delimiter.curly'],
        [/}/, { token: '@rematch', next: '@popall', nextEmbedded: '@pop' }],
        [/"/, 'string', '@string' ]
      ],
      
      componentname: [
        [/[A-Z][\w$]*/, { token: 'type', bracket: '@open' }],            
        [/\(/, { token: 'delimiter.parenthesis', next: '@componentArgs' }],
        [/{/, { token: 'delimiter.curly', next: '@componentChildren' }],
      ],

      componentArgs: [        
        [/\(/, { token: 'delimiter.parenthesis', bracket: '@open' }],
        [/[a-z][\w$]*/, 'attribute'],
        [/\)/, { token: '@rematch', bracket: '@close', next: '@pop' }],
      ],

      componentChildren: [
        [/{/, { token: 'delimiter.curly', bracket: '@open' }],
        [/element/, { token: 'keyword', next: '@element' }],
        [/slot/, { token: 'keyword', next: '@slot' }],
        [/[A-Z][\w]+/, { token: 'type', next: '@element' }],
        [/}/, { token: '@rematch', bracket: '@close', next: '@popall' }],
      ],

      slot: [
        [/\(/, { token: 'delimiter.parenthesis', bracket: '@open', next: '@elementParams' }],
        [/\)/, { token: '@rematch', bracket: '@close', next: '@pop' }],
      ],

      element: [
        [/\(/, { token: 'delimiter.parenthesis', bracket: '@open', next: '@elementParams' }],
        [/\)/, { token: '@rematch', bracket: '@close', next: '@pop' }],
        [/{/, { token: 'delimiter.curly', next: '@content' }],
        [/}/, { token: '@rematch', bracket: '@close', next: '@pop' }],
      ],

      elementParams: [     
        [/\(/, { token: 'delimiter.parenthesis', bracket: '@open' }],
        [/style/, 'keyword'],   
        [/"/, 'string', '@string' ],
        [/'/, 'string', '@string' ],
        [/,/, ''],
        [/[a-z][\w$-]*/, 'attribute'],
        [/\)/, { token: '@rematch', bracket: '@close', next: '@pop' }],
      ],

      content: [
        [/{/, { token: 'delimiter.curly', bracket: '@open' }],
        [/"/, 'string', '@string' ],
        [/'/, 'string', '@string' ],
        [/element/, { token: 'keyword', next: '@element' }],
        [/slot/, { token: 'keyword', next: '@slot' }],
        [/[A-Z][\w]+/, { token: 'type', next: '@element' }],
        [/}/, { token: '@rematch', bracket: '@close', next: '@pop' }],
      ]
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
      width="1000"
      height="100vh"
      language="stylo"
      theme="vs-dark"
      value="// Your code here"
      onChange={handleEditorChange}
    />
  );
};

export default CodeEditor;
