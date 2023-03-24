import { KW_APPLY, KW_CLASS, KW_COMPONENT, KW_RENDER, KW_PARAM, KW_SLOT_LOW, KW_SLOT_HIGH, KW_STYLE } from "./Constants";
import { Token, TokenType } from './StyloLexer';

//#region Nodes

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
  args: string[];
  children: ComponentChildNode[];
};

export type ComponentChildNode = HTMLElementNode | ComponentRefNode | SlotRefNode;

export type HTMLElementNode = {
  type: 'htmlElement';
  classes?: string[];
  style?: string;
  slot?: string;
  children?: ComponentChildNode[] | string;
}

export type ComponentRefNode = {
  type: 'componentRef';
  name: string;
  slot?: string;
  args: ComponentRefArgNode[],
  slotChildren?: ComponentChildNode[];
}

export type ComponentRefArgNode = {
  type: 'componentRefArg';
  value: string;
  valueType: 'string' | 'parameter'
}

export type SlotRefNode = {
  type: 'slotRef';
  name?: string;
}

// Root
export type Node = ParamNode | ClassNode | ComponentDefinitionNode;

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

      if (token.value === KW_PARAM) {
        nodes.push(this.parseParamDefinition());
      } else if (token.value === KW_CLASS) {
        nodes.push(this.parseClassDefinition());
      } else if (token.value === KW_RENDER) {
        this.expect(TokenType.Keyword, KW_RENDER);
        nodes.push(this.parseComponentDefinition(true));
      } else if (token.value === KW_COMPONENT) {
        nodes.push(this.parseComponentDefinition(false));
      } else {
        throw new Error(`Unexpected token '${token.type}' at (${token.line}, ${token.index})`);
      }
    }

    return nodes;
  }

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

  private parseComponentDefinition(display: boolean): ComponentDefinitionNode {
    this.expect(TokenType.Keyword, 'component');
    const name = this.parseTokenValue(TokenType.Identifier);

    let args: string[] | undefined = [];
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
    if (this.peekHasType(TokenType.Keyword)) {
      const name = this.parseTokenValue(TokenType.Keyword);
      if (name === KW_SLOT_HIGH) {
        return this.parseSlotReferenceNode();
      }
      return this.parseHtmlElement();
    }

    return this.parseComponentReferenceNode();
  }

  private parseSlotReferenceNode(): SlotRefNode {
    let name: string | undefined;
    if (this.peekHasType(TokenType.Lparen)) {
      this.expect(TokenType.Lparen);
      name = this.parseTokenValue(TokenType.Identifier);
      this.expect(TokenType.Rparen);
    }

    return {
      type: 'slotRef',
      name
    };
  }

  private parseHtmlElement(): HTMLElementNode {
    const classes: string[] = [];
    let keyValuePairs: { [key: string]: string } = {};

    if (this.peekHasType(TokenType.Lparen)) {
      this.expect(TokenType.Lparen);

      if (this.peekHasType(TokenType.Identifier)) {
        while (!this.peekHasType(TokenType.Comma) && !this.peekHasType(TokenType.Rparen)) {
          classes.push(this.parseTokenValue(TokenType.Identifier));
        }
        if (this.peekHasType(TokenType.Comma)) {
          this.expect(TokenType.Comma);
          keyValuePairs = this.parseKeywordValuePairs();
        }
      } else {
        keyValuePairs = this.parseKeywordValuePairs();
      }

      if (this.peekHasType(TokenType.Rparen)) {
        this.expect(TokenType.Rparen);
      }
    }

    this.expect(TokenType.Lbrace);
    let children: ComponentChildNode[] | string = [];
    if (this.peekHasType(TokenType.String)) {
      // String content
      children = this.parseTokenValue(TokenType.String);
      this.expect(TokenType.Rbrace);
    } else {
      // Array content
      while (!this.peekHasType(TokenType.Rbrace)) {
        children.push(this.parseComponentChild());
      }
      this.expect(TokenType.Rbrace);
    }

    return {
      type: 'htmlElement',
      children,
      classes,
      slot: keyValuePairs[KW_SLOT_LOW],
      style: keyValuePairs[KW_STYLE],
    }
  }

  private parseComponentReferenceNode(): ComponentRefNode {
    const name = this.expect(TokenType.Identifier);

    if (!this.componentStart.test(name.value![0])) {
      throw new Error(`Invalid component identifier '${name.value}' at (${name.line}, ${name.index})`);
    }

    const args: ComponentRefArgNode[] = [];
    let slot: string | undefined;

    if (this.peekHasType(TokenType.Lparen)) {
      this.expect(TokenType.Lparen);
      while (!this.peekHasType(TokenType.Rparen)) {
        if (this.peekHasType(TokenType.Keyword)) {
          this.expect(TokenType.Keyword, KW_SLOT_LOW);
          this.expect(TokenType.Equal);
          slot = this.parseTokenValue(TokenType.String);
        } else {
          const arg = this.parseComponentReferenceArgNode();
          args.push(arg);
        }
        if (this.peekHasType(TokenType.Comma)) {
          this.expect(TokenType.Comma);
        }
      }
      this.expect(TokenType.Rparen);
    }

    // Define Slot
    const slotChildren: ComponentChildNode[] = [];
    if (this.peekHasType(TokenType.Lbrace)) {
      this.expect(TokenType.Lbrace);

      while (!this.peekHasType(TokenType.Rbrace)) {
        slotChildren.push(this.parseComponentChild());
      }
      this.expect(TokenType.Rbrace);
    }

    return {
      type: 'componentRef',
      name: name.value!,
      slot,
      args,
      slotChildren
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

  //#endregion
}