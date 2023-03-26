import { FC, useEffect, useState } from "react";
import MonacoEditor from "react-monaco-editor";
import * as monaco from "monaco-editor";
import { debounce } from "lodash";

const registerCustomLanguage = () => {
  monaco.languages.register({ id: "stylo" });

  monaco.languages.setMonarchTokensProvider("stylo", {
    operators: ["=", ":"],

    // C# style strings
    escapes: /\\(?:[abfnrtv\\"']|x[0-9A-Fa-f]{1,4}|u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8})/,

    // The main tokenizer for our languages
    tokenizer: {
      root: [
        [/import/, { token: 'keyword' }],
        [/param/, { token: 'keyword', next: '@paramname' }],
        [/class/, { token: 'keyword', next: '@classname' }],
        [/render/, { token: 'keyword', next: '@componentChildren' }],
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
        [/[a-z][\w$-]*/, { token: 'constant', next: '@popall' }],
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
        [/Slot/, { token: 'type', next: '@element' }],
        [/render/, { token: 'keyword' }],
        [/[a-z][\w]+/, { token: 'tag', next: '@element' }],
        [/[A-Z][\w]+/, { token: 'type', next: '@element' }],
        [/}/, { token: '@rematch', bracket: '@close', next: '@popall' }],
      ],

      element: [
        [/\(/, { token: 'delimiter.parenthesis', bracket: '@open', next: '@elementParams' }],
        [/{/, { token: 'delimiter.curly', next: '@content' }],
        [/}/, { token: '@rematch', bracket: '@close', next: '@pop' }],
        [/[a-zA-Z][\w]+/, { token: '@rematch', next: '@pop' }],
      ],

      elementParams: [     
        [/\(/, { token: 'delimiter.parenthesis', bracket: '@open' }],
        [/\bclass|style|slot|name\b/, 'variable.name'], 
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
        [/Slot/, { token: 'type', next: '@element' }],
        [/[a-z][\w]+/, { token: 'tag', next: '@element' }],
        [/[A-Z][\w]+/, { token: 'type', next: '@element' }],
        [/}/, { token: 'delimiter.curly', bracket: '@close', next: '@pop' }],
      ]
    },
  });
};

type CodeEditorProps = {
  onChange: (newValue: string) => void;
};

const debounceMs = 300;
const initialValue = `// Add code here`;

const CodeEditor: FC<CodeEditorProps> = ({ onChange }) => {
  const [editorHeight, setEditorHeight] = useState(window.innerHeight);

  useEffect(() => {
    registerCustomLanguage();

    const handleResize = () => {
      setEditorHeight(window.innerHeight);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const handleEditorChange = debounce((newValue: string, _: any) => {
    onChange(newValue);
  }, debounceMs);

  return (
    <MonacoEditor
      width="100%"
      height={`${editorHeight}px`}
      language="stylo"
      theme="vs-dark"
      value={initialValue}
      onChange={handleEditorChange}
    />
  );
};

export default CodeEditor;
