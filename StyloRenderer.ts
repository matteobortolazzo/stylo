import { TAB } from "./Constants.ts";
import { ParamNode, ComponentDefinitionNode, ComponentRefNode, HTMLElementNode } from "./StyloParser.ts";
import { ClassNode } from "./StyloParser.ts";
import { Node } from "./StyloParser.ts";
import { ComponentChildNode } from "./StyloParser.ts";

type ComponentArgument = {
  name: string;
  value: string;
}

export default class StyloRenderer {
  private applyClasses = new Map<string, string>();
  private components = new Map<string, ComponentDefinitionNode>();

  constructor(private ast: Node[]) { }

  render(): string {
    const cssVariables = this.ast
      .filter((n) => n.type === "param")
      .map((n) => n as ParamNode)
      .map((n) => `      --${n.name}: ${n.value};`)
      .join("\n");
    const customClasses = this.ast
      .filter((n) => n.type === "class")
      .map((n) => n as ClassNode)
      .map((classNode) => this.renderCustomClass(classNode))
      .join("\n");

    const styleContent = cssVariables ? `:root {\n${cssVariables}\n${TAB}${TAB}}` : "";
    const styleBlock = `<style>\n${TAB}${TAB}${styleContent}\n${TAB}${customClasses}\n${TAB}</style>`;

    const componentDefinitionNodes = this.ast
      .filter((n) => n.type === "componentDef")
      .map((n) => n as ComponentDefinitionNode)

    for (const component of componentDefinitionNodes) {
      this.components.set(component.name, component);
    }

    let appContent = '';
    for (const component of componentDefinitionNodes.filter((c) => c.display)) {
      appContent += this.renderComponent(component);
    }

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
  <title>Stylo App</title>
  ${styleBlock}
</head>
<body>
  ${appContent}
</body>
</html>`;
  }

  private renderCustomClass(node: ClassNode): string {
    const cssProperties: string[] = [];

    for (const property of node.properties) {
      if (property.type === "cssProperty") {
        const value = property.value.join(' ');
        cssProperties.push(`${property.name}: ${value};`);
      } else if (property.type === "cssVariableNode") {
        cssProperties.push(`${property.name}: var(--${property.value});`);
      } else if (property.type === "apply") {
        this.applyClasses.set(node.name, property.value.join(' '))
      }
    }

    return `  .${node.name} {
      ${cssProperties.join("\n      ")}
    }`;
  }

  private renderComponent(component: ComponentDefinitionNode): string {
    const content = this.renderComponentChildren(component.children, TAB)
    return `<div data-comp="${component.name}">${content}\n${TAB}</div>`;
  }

  private renderComponentChildren(children: ComponentChildNode[], indent: string, parentArgs?: ComponentArgument[]): string {
    return children
      .map((child) => {
        switch (child.type) {
          case "htmlElement": {
            return this.renderHtmlElement(child as HTMLElementNode, indent, parentArgs)
          }
          case "componentRef": {
            return this.renderComponentRef(child as ComponentRefNode, indent, parentArgs);
          }
          default:
            return "";
        }
      })
      .join("");
  }
  
  private renderHtmlElement(htmlNode: HTMLElementNode, indent: string, parentArgs?: ComponentArgument[]): string {
    const tag = htmlNode.name;
    const styleAttr = htmlNode.style ? ` style="${htmlNode.style}"` : "";

    const appliedClasses = htmlNode.class?.split(' ').map((c) => this.applyClasses.get(c) || c).join(' ') || '';
    const classAttr = htmlNode.class ? ` class="${htmlNode.class} ${appliedClasses}"` : "";

    let content = '';
    if (Array.isArray(htmlNode.children)) {
      const childrenContent = this.renderComponentChildren(htmlNode.children, indent + TAB, parentArgs);
      content = `\n${indent}${TAB}${TAB}${childrenContent}\n${indent}${TAB}`;
    }
    else {
      content = htmlNode.children as string;
      if (parentArgs) {
        for (const argNode of parentArgs) {
          content = content.replace(`{${argNode.name}}`, argNode.value);
        }
      }
    }
    return `\n${TAB}${indent}<${tag}${classAttr}${styleAttr}>${content}</${tag}>`;
  }

  private renderComponentRef(refNode: ComponentRefNode, indent: string, parentArgs?: ComponentArgument[]): string {
    const component = this.components.get(refNode.name)
    if (!component) {
      throw new Error(`Component ${refNode.name} is not defined`)
    }

    const currentNodeArgs: ComponentArgument[] = [];
    if (component.args && component.args.length) {
      if (!refNode.args || !refNode.args.length || component.args.length !== refNode.args.length) {
        throw new Error(`Component ${refNode.name} requires ${component.args?.length} arguments, but ${refNode.args?.length ?? 0} were provided`)
      }

      for (let i = 0; i < component.args.length; i++) {
        const name = component.args[i];
        const argNode = refNode.args[i];
        if (argNode.valueType === 'string') {
           currentNodeArgs.push({ name, value: argNode.value })
        } else {
          const parantArg = parentArgs?.find((a) => a.name === argNode.value);
          if (!parantArg) {
            throw new Error(`Argument ${argNode.value} is not defined`)
          }
          currentNodeArgs.push({ name, value: parantArg.value })
        }
      }
    }

    return this.renderComponentChildren(component.children, indent, currentNodeArgs);
  }
}