import { Stopwatch } from "./Stopwatch.ts";
import { StyloLexer } from "./StyloLexer.ts";
import { StyloParser } from "./StyloParser.ts";
import { StyloRenderer } from "./StyloRenderer.ts";

export class StyloCompiler {
  private stopwatch = new Stopwatch();

  compile(input: string): string | undefined {
    try {      
      console.log(`Compiling...`);
      this.stopwatch.start();
      const lexer = new StyloLexer(input);
      const tokens = lexer.tokenize();
      const parser = new StyloParser(tokens);
      const ast = parser.parse();
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