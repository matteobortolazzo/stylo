import { Stopwatch } from "./Stopwatch";
import { StyloLexer } from "./StyloLexer";
import { Node, StyloParser } from "./StyloParser";
import { StyloRenderer } from "./StyloRenderer";

export class StyloCompiler {
  private stopwatch = new Stopwatch();
  private stdAtsJson: string;

  constructor() {
    // const std = stdPath;    
    // const lexer = new StyloLexer(std);
    // const tokens = lexer.tokenize();
    // const parser = new StyloParser(tokens);
    // const ast = parser.parse();
    // this.stdAtsJson = JSON.stringify(ast);
    this.stdAtsJson = '';
  }

  compile(input: string): string | undefined {
    try {      
      console.log(`Compiling...`);
      this.stopwatch.start();
      const lexer = new StyloLexer(input);
      const tokens = lexer.tokenize();
      const parser = new StyloParser(tokens);
      const ast = parser.parse();

      // const stdAst: Node[] = JSON.parse(this.stdAtsJson);
      // const renderer = new StyloRenderer([...stdAst, ...ast]);
      const renderer = new StyloRenderer(ast);
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