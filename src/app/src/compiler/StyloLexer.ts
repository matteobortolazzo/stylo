import { KW_APPLY, KW_CLASS, KW_COMPONENT, KW_RENDER, KW_PARAM, KW_SLOT_LOW, KW_STYLE, KW_NAME, KW_IMPORT } from "./Constants";

export enum TokenType {
  Identifier = 'Identifier',
  Keyword = 'Keyword',
  String = 'String',
  CssValue = 'CssValue',
  CssVariable = 'CssVariable',
  Lparen = 'Lparen',
  Rparen = 'Rparen',
  Lbrace = 'Lbrace',
  Rbrace = 'Rbrace',
  Colon = 'Colon',
  Semicolon = 'Semicolon',
  Comma = 'Comma',
  Equal = 'Equal'
}

export class Token {
  constructor(public type: TokenType, public value: string | null, public line: number, public index: number) {}
}

export class StyloLexer {
  private pos = 0;
  private input = '';
  private tokens: Token[] = [];

  private static readonly KEYWORDS = [
    KW_IMPORT,
    KW_RENDER,
    KW_PARAM,
    KW_COMPONENT,
    KW_CLASS,
    KW_STYLE,
    KW_NAME,
    KW_APPLY,
    KW_SLOT_LOW
  ];

  private static readonly WHITESPACE = /\s/;
  private static readonly NEWLINE = /\r?\n/;
  private static readonly WORD_START = /[@a-zA-Z]/;
  private static readonly CSSVALUE_START = /[0-9a-zA-Z]/;
  private static readonly WORD = /[-a-zA-Z0-9@_]/;

  tokenize(input: string): Token[] {
    this.pos = 0;
    this.input = input;
    this.tokens = [];

    while (this.pos < this.input.length) {
      const currentChar = this.input[this.pos];

      if (StyloLexer.WHITESPACE.test(currentChar)) {
        this.pos++;
        continue;
      }
  
      if (StyloLexer.NEWLINE.test(currentChar)) {
        this.pos++;
        if (currentChar === '\r' && this.input[this.pos] === '\n') {
          this.pos++;
        }
        continue;
      }

      if (currentChar === '/' && (this.input[this.pos + 1] === '/' || this.input[this.pos + 1] === '*')) {
        this.skipComments();
        continue;
      }
  
      if (StyloLexer.WORD_START.test(currentChar)) {
        this.tokenizeWord(StyloLexer.WORD, TokenType.Identifier, true);
        continue;
      }

      if (StyloLexer.CSSVALUE_START.test(currentChar)) {
        this.tokenizeCssValue();
        continue;
      }

      switch (currentChar) {
        case '(':
          this.addToken(TokenType.Lparen, '(');
          break;
        case ')':
          this.addToken(TokenType.Rparen, ')');
          break;
        case '{':
          this.addToken(TokenType.Lbrace, '{');
          break;
        case '}':
          this.addToken(TokenType.Rbrace, '}');
          break;
        case ':':
          this.addToken(TokenType.Colon, ':');
          break;
        case ';':
          this.addToken(TokenType.Semicolon, ';');
          break;
        case ',':
          this.addToken(TokenType.Comma, ',');
          break;
        case '$':          
          this.pos++;
          this.tokenizeWord(StyloLexer.WORD, TokenType.CssVariable, false);
          break;
        case '=':
          this.addToken(TokenType.Equal, '=');
          break;
        case '"':
        case "'":
          this.tokenizeString(currentChar);
          break;
      }

      this.pos++;
    }

    this.input = '';
    return this.tokens;
  }

  private skipComments(): void {
    if (this.input[this.pos + 1] === '/') {
      // Single-line comment
      this.pos += 2;
      while (this.pos < this.input.length && !StyloLexer.NEWLINE.test(this.input[this.pos])) {
        this.pos++;
      }
    } else if (this.input[this.pos + 1] === '*') {
      // Multi-line comment
      this.pos += 2;
      while (this.pos < this.input.length - 1 && !(this.input[this.pos] === '*' && this.input[this.pos + 1] === '/')) {
        this.pos++;
      }
      this.pos += 2;
    }
  }  

  private tokenizeWord(contentRegex: RegExp, type: TokenType, possibleKeyword: boolean): void {
    let word = '';
    const startIndex = this.pos;
    const startPosition = this.calculateStartLine(startIndex);
    while (
      this.pos < this.input.length &&
      contentRegex.test(this.input[this.pos])
    ) {
      if (this.input[this.pos] === '/' && (this.input[this.pos + 1] === '/' || this.input[this.pos + 1] === '*')) {
        this.skipComments();
      } else {
        word += this.input[this.pos++];
      }
    }
  
    const tokenType = possibleKeyword && StyloLexer.KEYWORDS.includes(word)
      ? TokenType.Keyword
      : type;
    this.tokens.push(new Token(tokenType, word, startPosition.line, startPosition.index));
  } 

  private tokenizeCssValue(): void {
    let word = '';
    const startIndex = this.pos;
    const startPosition = this.calculateStartLine(startIndex);
    while (
      this.pos < this.input.length &&
      this.input[this.pos] !== ';' && this.input[this.pos] !== '}') {
      word += this.input[this.pos++];
    }

    if (word.length > 0) {
      this.tokens.push(new Token(TokenType.CssValue, word, startPosition.line, startPosition.index));
    }
  }
  
  private tokenizeString(quote: string): void {
    let str = '';
    const startIndex = this.pos;
    const startPosition = this.calculateStartLine(startIndex);
    this.pos++;
    while (this.pos < this.input.length && this.input[this.pos] !== quote) {
      if (this.input[this.pos] === '\\') {
        this.pos++;
        if (this.pos < this.input.length) {
          str += this.input[this.pos];
        }
      } else {
        str += this.input[this.pos];
      }
      this.pos++;
    }
  
    this.tokens.push(new Token(TokenType.String, str, startPosition.line, startPosition.index));
  }
  
  private addToken(type: TokenType, value: string): void {
    const startIndex = this.pos;
    const startPosition = this.calculateStartLine(startIndex);
    this.tokens.push(new Token(type, value, startPosition.line, startPosition.index));
  }
  
  private calculateStartLine(index: number): {line: number, index: number} {
    const inputUntilIndex = this.input.substring(0, index);
    const line = inputUntilIndex.split('\n').length;
    const lastNewlineIndex = inputUntilIndex.lastIndexOf('\n');
    const indexOnLine = index - (lastNewlineIndex + 1) + 1;
    return { line, index: indexOnLine };
  }
}
