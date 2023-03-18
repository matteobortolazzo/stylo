import StyloLexer from "./StyloLexer.ts";
import { StyloParser } from "./StyloParser.ts";
import StyloRenderer from "./StyloRenderer.ts";

const text = await Deno.readTextFile("./myapp.stylo");
const lexer = new StyloLexer(text);
const tokens = lexer.tokenize();
const parser = new StyloParser(tokens);
const ast = parser.parse();
const renderer = new StyloRenderer(ast);
const html = renderer.render();
await Deno.writeTextFile("./myapp.html", html);
console.log('Done!');
console.log(html);