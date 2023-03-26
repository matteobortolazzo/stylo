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
  value: string[];
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
  name: string;
  args: string[];
  children: ComponentChildNode[];
};

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
  private componentStart = /[A-Z]/;

  constructor(private tokens: Token[]) { }

  parse(): Node[] {
    const nodes: Node[] = [];
    
    while (this.pos < this.tokens.length) {
      const token = this.peek();
      if (token.type !== TokenType.Keyword) {
        throw new Error(`Unexpected token at '${token.type}' at (${token.line}, ${token.index})`);
      }
      nodes.push(this.getNextNode(token));
    }

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

    if (this.peekHasType(TokenType.CssVariable)) {
      return this.parseCssVariable(name)
    }
    return this.parseCssPropertyValue(name);
  }

  private parseCssVariable(name: string): CssVariableNode {
    const value = this.parseTokenValue(TokenType.CssVariable);
    return {
      type: 'cssVariableNode',
      name,
      value,
    };
  }

  private parseCssPropertyValue(name: string): CssPropertyNode {
    const value: string[] = [];
    while (!this.peekHasType(TokenType.Semicolon)) {
      const nextTokenType = this.peekHasType(TokenType.CssValue)
        ? TokenType.CssValue
        : TokenType.Identifier;
      value.push(this.parseTokenValue(nextTokenType));
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
    this.expect(TokenType.Keyword, 'component');
    const name = this.parseTokenValue(TokenType.Identifier);

    let args: string[] | undefined = [];
    if (this.peekHasType(TokenType.Lparen)) {
      args = this.parseComponentArguments();
    }

    const children = this.parseComponentChildren();

    return {
      type: 'componentDef',
      name,
      args,
      children
    }
  }

  private parseComponentArguments(): string[] {
    this.expect(TokenType.Lparen);
    const items: string[] = [];
    while (!this.peekHasType(TokenType.Rparen)) {
      items.push(this.parseTokenValue(TokenType.Identifier));
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
    const currentToken = this.expect(TokenType.Identifier);
    const name = currentToken.value!

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
        throw new Error(`Slot cannot have children at (${currentToken.line}, ${currentToken.index})`);
      }
      if (args.length > 0) {
        throw new Error(`Slot cannot have arguments at (${currentToken.line}, ${currentToken.index})`);
      }
      if (slotAttr) {
        throw new Error(`Slot cannot have a class at (${currentToken.line}, ${currentToken.index})`);
      }
      if (styleAttr) {
        throw new Error(`Slot cannot have a style at (${currentToken.line}, ${currentToken.index})`);
      }
      if (classAttr) {
        throw new Error(`Slot cannot have a class at (${currentToken.line}, ${currentToken.index})`);
      }
    }
    else if (type === 'block') {
      if (!children.length) {
        throw new Error(`Block must have children at (${currentToken.line}, ${currentToken.index})`);
      }
      if (args.length > 0) {
        throw new Error(`Block cannot have arguments at (${currentToken.line}, ${currentToken.index})`);
      }
      if (nameAttr) {
        throw new Error(`Block cannot have a name at (${currentToken.line}, ${currentToken.index})`);
      }
    } else if (type === 'componentRef') {
      if (!Array.isArray(children)) {
        throw new Error(`Component cannot have string children at (${currentToken.line}, ${currentToken.index})`);
      }
      if (nameAttr) {
        throw new Error(`Component cannot have a name at (${currentToken.line}, ${currentToken.index})`);
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