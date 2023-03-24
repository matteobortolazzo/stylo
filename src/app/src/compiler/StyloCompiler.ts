import { Stopwatch } from "./Stopwatch";
import { StyloLexer } from "./StyloLexer";
import { StyloParser } from "./StyloParser";
import { RenderResult, StyloRenderer } from "./StyloRenderer";

export class StyloCompiler {
  private stopwatch = new Stopwatch();

  compile(input: string): RenderResult | undefined {
    try {      
      console.log(`Compiling...`);
      this.stopwatch.start();
      const lexer = new StyloLexer(input);
      const tokens = lexer.tokenize();
      const parser = new StyloParser(tokens);
      const ast = parser.parse();
      const renderer = new StyloRenderer(ast);
      const render = renderer.render();

      const elapsedTime = this.stopwatch.stop();
      console.log(`%cCompiled in ${elapsedTime} ms`, "color: green");
      console.log();

      return render;
    }
    catch (e) {
      console.log(`%c${e}`, "color: red");
      console.log();
      return undefined;
    }
  }
}