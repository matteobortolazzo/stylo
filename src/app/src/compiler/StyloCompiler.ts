import { Stopwatch } from "./Stopwatch";
import { StyloLexer } from "./StyloLexer";
import { Node, ImportNode, StyloParser } from "./StyloParser";
import { RenderResult, StyloRenderer } from "./StyloRenderer";

export class StyloCompiler {
  private stopwatch = new Stopwatch();
  private importAst: Record<string, Node[]> = {}

  async compile(input: string): Promise<RenderResult | undefined> {
    try {
      console.log(`Compiling...`);
      this.stopwatch.start();
      const lexer = new StyloLexer(input);
      const tokens = lexer.tokenize();
      const parser = new StyloParser(tokens);
      const ast = parser.parse();

      // Imports
      const importNodes = ast
        .filter(n => n.type === "import")
        .map(n => n as ImportNode)
        .map(n => n.path);
      const importAst = await this.getImportAst(importNodes);

      const renderer = new StyloRenderer([...importAst, ...ast]);
      const render = renderer.render();

      const elapsedTime = this.stopwatch.stop();
      console.log(`%cCompiled in ${elapsedTime} ms`, "color: green");
      console.log();

      return render;
    }
    catch (e) {
      this.stopwatch.stop();
      console.log(`%c${e}`, "color: red");
      console.log();
      return undefined;
    }
  }

  private async getImportAst(importPaths: string[]): Promise<Node[]> {
    const nodes = [];

    for (const path of importPaths) {
      let ast: Node[] = [];
      
      if (this.importAst[path]) {
        ast = this.importAst[path];
      } else {
        const response = await fetch(`${path}.stylo`);
        const content = await response.text();
        const lexer = new StyloLexer(content);
        const tokens = lexer.tokenize();
        const parser = new StyloParser(tokens);
        ast = parser.parse();
        this.importAst[path] = ast;
      }

      for (const node of ast) {
        nodes.push(node);
      }
    }

    return nodes;
  }
}