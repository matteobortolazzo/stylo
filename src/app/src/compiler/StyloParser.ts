import { KW_APPLY, KW_CLASS, KW_COMPONENT, KW_RENDER, KW_PARAM, KW_SLOT_LOW, KW_SLOT_HIGH, KW_STYLE, KW_NAME, KW_IMPORT } from "./Constants";
import { Token, TokenType } from './StyloLexer';

//#region Nodes

// Import
export type ImportNode = {
  type: 'import';
  path: string;
};

// Render
export type RenderNode = {
  type: 'render';
  child: ComponentChildNode;
};

// Param
export type ParamNode = {
  type: 'param';
  name: string;
  value: string;
};

// Classe
export type ClassNode = {
  type: 'class';
  name: string;
  properties: ClassChildNode[];
};

export type ClassChildNode = CssPropertyNode | CssVariableNode | ApplyNode;

export type CssPropertyNode = {
  type: 'cssProperty';
  name: string;
  value: string;
};

export type CssVariableNode = {
  type: 'cssVariableNode';
  name: string;
  value: string;
};

export type ApplyNode = {
  type: 'apply';
  name: string;
  value: string[];
};

// Component

export type ComponentDefinitionNode = {
  type: 'componentDef';
  position: CodePosition,
  name: string;
  args: ComponentDefinitionArgNode[];
  children: ComponentChildNode[];
};

export type ComponentDefinitionArgNode = {
  type: 'componentDefArg';
  name: string;
  defaultValue?: string;
}

export type CodePosition = {
  startLine: number;
  endLine: number;
}

export type ComponentChildNode = {
  type: 'block' | 'componentRef' | 'slotRef';
  name?: string;
  class?: string;
  style?: string;
  slot?: string;
  args?: ComponentRefArgNode[],
  children?: ComponentChildNode[] | string;
}

export type ComponentRefArgNode = {
  type: 'componentRefArg';
  value: string;
  valueType: 'string' | 'parameter'
}

// Root
export type Node = ImportNode | RenderNode | ParamNode | ClassNode | ComponentDefinitionNode;

//#endregion

export class StyloParser {  
  private pos = 0;
  private tokens: Token[] = [];
  
  private componentStart = /[A-Z]/;

  parse(tokens: Token[]): Node[] {
    this.pos = 0;
    this.tokens = tokens;
    const nodes: Node[] = [];
    
    while (this.pos < this.tokens.length) {
      const token = this.peek();
      if (token.type !== TokenType.Keyword) {
        throw new Error(`Unexpected token at '${token.type}' at (${token.line}, ${token.index})`);
      }
      nodes.push(this.getNextNode(token));
    }

    this.tokens = [];
    return nodes;
  }

  private getNextNode(token: Token): Node {
    if (token.value === KW_IMPORT) {
      return this.parseImport();
    } else if (token.value === KW_PARAM) {
      return this.parseParamDefinition();
    } else if (token.value === KW_CLASS) {
      return this.parseClassDefinition();
    } else if (token.value === KW_COMPONENT) {
      return this.parseComponentDefinition();
    } else if (token.value === KW_RENDER) {
      return this.parseRender();
    } else {
      throw new Error(`Unexpected token '${token.type}' at (${token.line}, ${token.index})`);
    }
  }

  //#region Import

  private parseImport(): ImportNode {
    this.expect(TokenType.Keyword, KW_IMPORT);
    const path = this.parseTokenValue(TokenType.String);
    return {
      type: 'import',
      path
    };
  }

  //#endregion

  //#region Render

  private parseRender(): RenderNode {
    this.expect(TokenType.Keyword, KW_RENDER);
    const child = this.parseComponentChild();
    return {
      type: 'render',
      child
    }
  }

  //#endregion

  //#region Param

  private parseParamDefinition(): ParamNode {
    this.expect(TokenType.Keyword, 'param');
    const name = this.parseTokenValue(TokenType.Identifier);
    this.expect(TokenType.Equal);
    const value = this.parseTokenValue(TokenType.String);

    return {
      type: 'param',
      name,
      value,
    };
  }

  //#endregion

  //#region Class

  private parseClassDefinition(): ClassNode {
    this.expect(TokenType.Keyword, 'class');
    const name = this.parseTokenValue(TokenType.Identifier);
    this.expect(TokenType.Lbrace);

    const properties: ClassChildNode[] = [];
    while (!this.peekHasType(TokenType.Rbrace)) {
      properties.push(this.parseClassChild());
    }

    this.expect(TokenType.Rbrace);

    return {
      type: 'class',
      name,
      properties,
    };
  }

  private parseClassChild(): ClassChildNode {
    if (this.peekHasType(TokenType.Keyword)) {
      return this.parseApply();
    }
    return this.parseCssProperty();
  }

  private parseCssProperty(): CssPropertyNode | CssVariableNode {
    const name = this.parseTokenValue(TokenType.Identifier);
    this.expect(TokenType.Colon);

    let value = '';
    while(!this.peekHasType(TokenType.Semicolon)){
      value += this.peek().value;
      this.pos++;
    }

    this.expect(TokenType.Semicolon);

    return {
      type: 'cssProperty',
      name,
      value,
    };
  }

  private parseApply(): ApplyNode {
    this.expect(TokenType.Keyword, KW_APPLY);

    const value: string[] = [];
    while (!this.peekHasType(TokenType.Semicolon)) {
      value.push(this.parseTokenValue(TokenType.Identifier));
    }
    this.expect(TokenType.Semicolon);

    return {
      type: 'apply',
      name: KW_APPLY,
      value,
    };
  }

  //#endregion

  //#region Component

  private parseComponentDefinition(): ComponentDefinitionNode {
    const token = this.peek();
    this.expect(TokenType.Keyword, 'component');
    const name = this.parseTokenValue(TokenType.Identifier);

    let args: ComponentDefinitionArgNode[] | undefined = [];
    if (this.peekHasType(TokenType.Lparen)) {
      args = this.parseComponentArguments();
    }

    const children = this.parseComponentChildren();

    const currentToken = this.peek();
    const position: CodePosition = {
      startLine: token.line,
      endLine: currentToken ? currentToken.line - 1 : this.tokens[this.tokens.length - 1].line
    }
    return {
      type: 'componentDef',
      position,
      name,
      args,
      children
    }
  }

  private parseComponentArguments(): ComponentDefinitionArgNode[] {
    this.expect(TokenType.Lparen);
    const items: ComponentDefinitionArgNode[] = [];
    let defaultValueFound = false;
    while (!this.peekHasType(TokenType.Rparen)) {
      const token = this.peek();
      const name = this.parseTokenValue(TokenType.Identifier);
      let defaultValue: string | undefined = undefined;

      if (this.peekHasType(TokenType.Equal)) {
        this.expect(TokenType.Equal);
        defaultValue = this.parseTokenValue(TokenType.String);
        defaultValueFound = true;
      } else {
        if (defaultValueFound) {
          throw new Error(`Cannot have a non-default argument after a default argument at (${token.line}, ${token.index})`);
        }
      }

      const argNode: ComponentDefinitionArgNode = {
        type: 'componentDefArg',
        name,
        defaultValue
      };
      items.push(argNode);
      if (this.peekHasType(TokenType.Comma)) {
        this.expect(TokenType.Comma);
      }
    }

    this.expect(TokenType.Rparen);
    return items;
  }

  private parseComponentChildren(): ComponentChildNode[] {
    this.expect(TokenType.Lbrace);

    const children: ComponentChildNode[] = [];
    while (!this.peekHasType(TokenType.Rbrace)) {
      children.push(this.parseComponentChild());
    }

    this.expect(TokenType.Rbrace);
    return children;
  }

  private parseComponentChild(): ComponentChildNode {
    const token = this.expect(TokenType.Identifier);
    const name = token.value!

    const type = name !== KW_SLOT_HIGH
      ? this.componentStart.test(name![0]) ? 'componentRef' : 'block'
      : 'slotRef'

    if (this.eof()) {
      return {
        type,
        name,
        args: [],
        children: []
      }
    }

    const args: ComponentRefArgNode[] = [];
    let keyValuePairs: { [key: string]: string } = {};

    // Between (...)
    if (this.peekHasType(TokenType.Lparen)) {
      this.expect(TokenType.Lparen);

      // Parse component args
      while (this.peekHasType(TokenType.Identifier) || this.peekHasType(TokenType.String)) {
        args.push(this.parseComponentReferenceArgNode());
        if (this.peekHasType(TokenType.Comma)) {
          this.expect(TokenType.Comma);
        }
      }

      // Parse slot, class, style
      keyValuePairs = this.parseKeywordValuePairs();
      this.expect(TokenType.Rparen);
    }

    const slotAttr = keyValuePairs[KW_SLOT_LOW];
    const classAttr = keyValuePairs[KW_CLASS];
    const styleAttr = keyValuePairs[KW_STYLE];
    const nameAttr = keyValuePairs[KW_NAME];

    if (this.eof()) {
      return {
        type,
        name,
        args,
        children: [],
        slot: slotAttr,
        class: classAttr,
        style: styleAttr
      }
    }

    // Parse content
    let children: ComponentChildNode[] | string = [];
    if (this.peekHasType(TokenType.Lbrace)) {
      this.expect(TokenType.Lbrace);

      while (!this.peekHasType(TokenType.Rbrace)) {
        if (this.peekHasType(TokenType.String)) {
          children = this.parseTokenValue(TokenType.String);
          break;
        }
        children.push(this.parseComponentChild());
      }
      this.expect(TokenType.Rbrace);
    }

    if (type === 'slotRef') {
      if (children.length > 0) {
        throw new Error(`Slot cannot have children at (${token.line}, ${token.index})`);
      }
      if (args.length > 0) {
        throw new Error(`Slot cannot have arguments at (${token.line}, ${token.index})`);
      }
      if (slotAttr) {
        throw new Error(`Slot cannot have a class at (${token.line}, ${token.index})`);
      }
      if (styleAttr) {
        throw new Error(`Slot cannot have a style at (${token.line}, ${token.index})`);
      }
      if (classAttr) {
        throw new Error(`Slot cannot have a class at (${token.line}, ${token.index})`);
      }
    }
    else if (type === 'block') {
      if (args.length > 0) {
        throw new Error(`Block cannot have arguments at (${token.line}, ${token.index})`);
      }
      if (nameAttr) {
        throw new Error(`Block cannot have a name at (${token.line}, ${token.index})`);
      }
    } else if (type === 'componentRef') {
      if (!Array.isArray(children)) {
        throw new Error(`Component cannot have string children at (${token.line}, ${token.index})`);
      }
      if (nameAttr) {
        throw new Error(`Component cannot have a name at (${token.line}, ${token.index})`);
      }
    }

    return {
      type,
      name: type === 'slotRef' ? nameAttr : name,
      args,
      children,
      slot: slotAttr,
      class: classAttr,
      style: styleAttr
    }
  }

  private parseComponentReferenceArgNode(): ComponentRefArgNode {
    const token = this.peek();
    if (this.peekHasType(TokenType.Identifier)) {
      const value = this.parseTokenValue(TokenType.Identifier);
      return {
        type: 'componentRefArg',
        value,
        valueType: 'parameter'
      }
    } else if (this.peekHasType(TokenType.String)) {
      const value = this.parseTokenValue(TokenType.String);
      return {
        type: 'componentRefArg',
        value,
        valueType: 'string'
      }
    }
    throw new Error(`Expected identifier or string at (${token.line}, ${token.index})`);
  }

  //#endregion

  //#region Utils

  private parseKeywordValuePairs(): { [key: string]: string } {
    const pairs: { [key: string]: string } = {};

    while (!this.peekHasType(TokenType.Rparen)) {
      const keyword = this.parseTokenValue(TokenType.Keyword)
      this.expect(TokenType.Equal);
      const value = this.parseTokenValue(TokenType.String)

      pairs[keyword] = value;

      if (this.peekHasType(TokenType.Comma)) {
        this.expect(TokenType.Comma);
      }
    }
    return pairs;
  }

  private expect(type: TokenType, value?: string): Token {
    const token = this.peek();
    if (token.type !== type || (value !== undefined && token.value !== value)) {
      if (value) {
        throw new Error(`Expected token of type '${type}' and value '${value}', but got token of type '${token.type}' and value '${token.value}' at (${token.line}, ${token.index})`);
      }
      throw new Error(`Expected token of type '${type}', but got token of type '${token.type}' at (${token.line}, ${token.index})`);
    }
    this.pos++;
    return token;
  }

  private parseTokenValue(tokenType: TokenType): string {
    const token = this.expect(tokenType);
    return token.value as string;
  }

  private peekHasType(type: TokenType): boolean {
    return this.peek().type === type;
  }

  private peek(): Token {
    return this.tokens[this.pos];
  }

  private eof(): boolean {
    return this.pos >= this.tokens.length;
  }

  //#endregion
}
