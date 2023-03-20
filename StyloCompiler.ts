import { Stopwatch } from "./Stopwatch.ts";
import { StyloLexer } from "./StyloLexer.ts";
import { Node, StyloParser } from "./StyloParser.ts";
import { StyloRenderer } from "./StyloRenderer.ts";

export class StyloCompiler {
  private STD_PATH = "./std.stylo";
  private stopwatch = new Stopwatch();
  private stdAtsJson: string;

  constructor() {
    const std = Deno.readTextFileSync(this.STD_PATH);    
    const lexer = new StyloLexer(std);
    const tokens = lexer.tokenize();
    const parser = new StyloParser(tokens);
    const ast = parser.parse();
    this.stdAtsJson = JSON.stringify(ast);
  }

  compile(input: string): string | undefined {
    try {      
      console.log(`Compiling...`);
      this.stopwatch.start();
      const lexer = new StyloLexer(input);
      const tokens = lexer.tokenize();
      const parser = new StyloParser(tokens);
      const ast = parser.parse();

      const stdAst: Node[] = JSON.parse(this.stdAtsJson);

      const renderer = new StyloRenderer([...stdAst, ...ast]);
      const html = renderer.render();

      const elapsedTime = this.stopwatch.stop();
      console.log(`%cCompiled in ${elapsedTime} ms`, "color: green");
      console.log();

      return html;
    }
    catch (e) {
      console.log(`%c${e}`, "color: red");
      console.log();
      return undefined;
    }
  }
}