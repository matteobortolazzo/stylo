import * as KW from "./Constants.ts";
import { Token, TokenType } from './StyloLexer.ts';

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
  display: boolean;
  name: string;
  args?: string[];
  children: ComponentChildNode[];
};

export type ComponentChildNode = HTMLElementNode | ComponentRefNode;

export type HTMLElementNode = {
  type: 'htmlElement';
  name: string;
  class?: string;
  style?: string;
  children?: ComponentChildNode[] | string;
}

export type ComponentRefNode = {
  type: 'componentRef';
  name: string;
  args?: ComponentRefArgNode[]
}

export type ComponentRefArgNode = {
  type: 'componentRefArg';
  value: string;
  valueType: 'string' | 'parameter'
}

// Root
export type Node = ParamNode | ClassNode | ComponentDefinitionNode;

export class StyloParser {
  private pos = 0;

  constructor(private tokens: Token[]) { }

  private static readonly HTML_ELEMENT_START = /[a-z]/;

  parse(): Node[] {
    const nodes: Node[] = [];

    while (this.pos < this.tokens.length) {
      const token = this.tokens[this.pos];

      if (token.type !== TokenType.Keyword) {
        throw new Error(`Unexpected token: ${token.type}`);
      }

      if (token.value === KW.PARAM) {
        nodes.push(this.parseParam());
      } else if (token.value === KW.CLASS) {
        nodes.push(this.parseClass());
      } else if (token.value === KW.DISPLAY) {
        this.expect(TokenType.Keyword, KW.DISPLAY);
        nodes.push(this.parseComponent(true));
      } else if (token.value === KW.COMPONENT) {
        nodes.push(this.parseComponent(false));
      } else {
        throw new Error(`Unexpected token: ${token.type}`);
      }
    }

    return nodes;
  }

  //#region Param

  private parseParam(): ParamNode {
    this.expect(TokenType.Keyword, 'param');
    const name = this.parseTokenValue(TokenType.Identifier);
    this.expect(TokenType.Equal);
    const value = this.parseTokenValue(TokenType.String);

    return {
      type: 'param',
      name: name,
      value: value,
    };
  }

  //#endregion

  //#region Class

  private parseClass(): ClassNode {
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
    this.expect(TokenType.Keyword, KW.APPLY);

    const value: string[] = [];
    while (!this.peekHasType(TokenType.Semicolon)) {
      value.push(this.parseTokenValue(TokenType.Identifier));
    }
    this.expect(TokenType.Semicolon);

    return {
      type: 'apply',
      name: KW.APPLY,
      value,
    };
  }

  //#endregion

  //#region Component

  private parseComponent(display: boolean): ComponentDefinitionNode {
    this.expect(TokenType.Keyword, 'component');
    const name = this.parseTokenValue(TokenType.Identifier);

    let args: string[] | undefined;
    if (this.peekHasType(TokenType.Lparen)) {
      args = this.parseComponentArguments();
    }

    const children = this.parseComponentChildren();

    return {
      type: 'componentDef',
      display,
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
    const name = this.parseTokenValue(TokenType.Identifier);
    if (StyloParser.HTML_ELEMENT_START.test((name)[0])) {
      return this.parseHtmlElement(name);
    }
    return this.parseComponentReferenceNode(name);
  }

  private parseHtmlElement(name: string): HTMLElementNode {
    const keyValuePairs = this.parseKeywordValuePairs();

    this.expect(TokenType.Lbrace);

    if (this.peekHasType(TokenType.String)) {
      const content = this.parseTokenValue(TokenType.String);
      this.expect(TokenType.Rbrace);
      return {
        type: 'htmlElement',
        name: name,
        children: content,
        class: keyValuePairs[KW.CLASS],
        style: keyValuePairs[KW.STYLE],
      }
    }

    const children: ComponentChildNode[] = [];
    while (!this.peekHasType(TokenType.Rbrace)) {
      children.push(this.parseComponentChild());
    }
    this.expect(TokenType.Rbrace);

    return {
      type: 'htmlElement',
      name: name,
      children,
      class: keyValuePairs[KW.CLASS],
      style: keyValuePairs[KW.STYLE],
    }
  }

  //#endregion

  //#region Utils

  private expect(type: TokenType, value?: string): Token {
    const token = this.tokens[this.pos];
    if (token.type !== type || (value !== undefined && token.value !== value)) {
      throw new Error(
        `Expected token of type ${type} and value ${value}, but got token of type ${token.type} and value ${token.value}`
      );
    }
    this.pos++;
    return token;
  }

  private parseComponentReferenceNode(name: string): ComponentRefNode {
    const args: ComponentRefArgNode[] = [];

    if (this.peekHasType(TokenType.Lparen)) {
      this.expect(TokenType.Lparen);
      while (!this.peekHasType(TokenType.Rparen)) {
        const arg = this.parseComponentReferenceArgNode();
        args.push(arg);
        if (this.peekHasType(TokenType.Comma)) {
          this.expect(TokenType.Comma);
        }
      }
      this.expect(TokenType.Rparen);
    }

    return {
      type: 'componentRef',
      name,
      args
    }
  }

  private parseComponentReferenceArgNode(): ComponentRefArgNode {
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
    throw new Error('Expected identifier or string');
  }

  private parseTokenValue(tokenType: TokenType): string {
    const token = this.expect(tokenType);
    return token.value as string;
  }

  private parseKeywordValuePairs(): { [key: string]: string } {
    const pairs: { [key: string]: string } = {};
    if (this.peekHasType(TokenType.Lparen)) {
      this.expect(TokenType.Lparen)
      while (!this.peekHasType(TokenType.Rparen)) {
        const keyword = this.parseTokenValue(TokenType.Keyword)
        this.expect(TokenType.Equal);
        const value = this.parseTokenValue(TokenType.String)

        pairs[keyword] = value;

        if (this.peekHasType(TokenType.Comma)) {
          this.expect(TokenType.Comma);
        }
      }
      this.expect(TokenType.Rparen);
    }
    return pairs;
  }

  private peekHasType(type: TokenType): boolean {
    return this.tokens[this.pos].type === type;
  }

  //#endregion
}