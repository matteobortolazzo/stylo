import * as KW from "./Constants.ts";

export enum TokenType {
  Identifier = 'Identifier',
  Keyword = 'Keyword',
  String = 'String',
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
  constructor(public type: TokenType, public value: string | null) {}
}

export default class StyloLexer {
  private pos = 0;
  private tokens: Token[] = [];

  constructor(private input: string) {}

  private static readonly KEYWORDS = [
    KW.DISPLAY,
    KW.PARAM,
    KW.COMPONENT,
    KW.CLASS,
    KW.STYLE,
    KW.BASE,
    KW.APPLY,
  ];

  private static readonly WHITESPACE = /\s/;
  private static readonly NEWLINE = /\r?\n/;
  private static readonly WORD_START = /[@a-zA-Z_]/;
  private static readonly WORD = /[-a-zA-Z0-9@_]/;

  tokenize(): Token[] {
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
  
      if (StyloLexer.WORD_START.test(currentChar)) {
        this.tokenizeWord();
        continue;
      }

      switch (currentChar) {
        case '(':
          this.addToken(TokenType.Lparen);
          break;
        case ')':
          this.addToken(TokenType.Rparen);
          break;
        case '{':
          this.addToken(TokenType.Lbrace);
          break;
        case '}':
          this.addToken(TokenType.Rbrace);
          break;
        case ':':
          this.addToken(TokenType.Colon);
          break;
        case ';':
          this.addToken(TokenType.Semicolon);
          break;
        case ',':
          this.addToken(TokenType.Comma);
          break;
        case '$':
          this.tokenizeCssVariable();
          break;
        case '=':
          this.addToken(TokenType.Equal);
          break;
        case '"':
        case "'":
          this.tokenizeString(currentChar);
          break;
        default:
          throw new Error(`Unexpected character: ${currentChar}`);
      }

      this.pos++;
    }

    return this.tokens;
  }

  private tokenizeWord(): void {
    let word = '';
    while (
      this.pos < this.input.length &&
      StyloLexer.WORD.test(this.input[this.pos])
    ) {
      word += this.input[this.pos++];
    }    

    if (StyloLexer.KEYWORDS.includes(word)) {
      this.tokens.push(new Token(TokenType.Keyword, word));
    } else {
      this.tokens.push(new Token(TokenType.Identifier, word));
    }
  }

  private tokenizeCssVariable(): void {
    let word = '';
    this.pos++;
    while (
      this.pos < this.input.length &&
      StyloLexer.WORD.test(this.input[this.pos])
    ) {
      word += this.input[this.pos++];
    }    

    this.tokens.push(new Token(TokenType.CssVariable, word));
    this.pos++;
  }

  private tokenizeString(quote: string): void {
    let str = '';
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

    this.tokens.push(new Token(TokenType.String, str));
  }

  private addToken(type: TokenType): void {
    this.tokens.push(new Token(type, null));
  }
}
