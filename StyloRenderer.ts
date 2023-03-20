import { TAB } from "./Constants.ts";
import { ParamNode, ComponentDefinitionNode, ComponentRefNode, HTMLElementNode, SlotRefNode } from "./StyloParser.ts";
import { ClassNode } from "./StyloParser.ts";
import { Node } from "./StyloParser.ts";
import { ComponentChildNode } from "./StyloParser.ts";

type ComponentArgument = {
  name: string;
  value: string;
}

export class StyloRenderer {
  private parameters = new Map<string, string>();
  private applyClasses = new Map<string, string>();
  private components = new Map<string, ComponentDefinitionNode>();

  constructor(private ast: Node[]) { }

  render(): string {
    const cssVariables = this.ast
      .filter((n) => n.type === "param")
      .map(n => this.renderParameters(n as ParamNode))
      .join("\n");
    const customClasses = this.ast
      .filter((n) => n.type === "class")
      .map(n => this.renderCustomClass(n as ClassNode))
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

  private renderParameters(node: ParamNode): string {
    this.parameters.set(node.name, node.value);
    return `      --${node.name}: ${node.value};`;
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

  private renderComponentChildren(
    children: ComponentChildNode[],
    indent: string,
    parentArgs?: ComponentArgument[],
    parentSlots?: ComponentChildNode[]): string {
    return children
      .map(child => this.renderComponentChild(child, indent, parentArgs, parentSlots))
      .join("");
  }

  private renderComponentChild(
    child: ComponentChildNode,
    indent: string,
    parentArgs?: ComponentArgument[],
    parentSlots?: ComponentChildNode[]): string {
    switch (child.type) {
      case "htmlElement": {
        return this.renderHtmlElement(child as HTMLElementNode, indent, parentArgs, parentSlots)
      }
      case "componentRef": {
        return this.renderComponentRef(child as ComponentRefNode, indent, parentArgs);
      }
      case "slotRef": {
        return this.renderSlotRef(child as SlotRefNode, indent, parentArgs, parentSlots);
      }
      default:
        return "";
    }
  }

  private renderSlotRef(
    slotRef: SlotRefNode,
    indent: string,
    parentArgs?: ComponentArgument[],
    parentSlots?: ComponentChildNode[]): string {

    if (!parentSlots) {
      return "";
    }

    const slotNode = this.getComponentSlotDef(slotRef, parentSlots);
    if (!slotNode) {
      return "";
    }
    return this.renderComponentChild(slotNode, indent, parentArgs, parentSlots);
  }

  private renderHtmlElement(
    htmlElement: HTMLElementNode,
    indent: string,
    parentArgs?: ComponentArgument[],
    parentSlots?: ComponentChildNode[]): string {
    const tag = htmlElement.name;
    const styleAttr = htmlElement.style ? ` style="${htmlElement.style}"` : "";
    // Custom classes
    const appliedClasses = htmlElement.class?.split(' ').map((c) => this.applyClasses.get(c) || c).join(' ') || '';
    const classAttr = htmlElement.class ? ` class="${htmlElement.class} ${appliedClasses}"` : "";

    let content = '';
    // Render child nodes
    if (Array.isArray(htmlElement.children)) {
      const childrenContent = this.renderComponentChildren(htmlElement.children, indent + TAB, parentArgs, parentSlots);
      content = `\n${indent}${TAB}${TAB}${childrenContent}\n${indent}${TAB}`;
    }
    // Replace string templates
    else {
      content = htmlElement.children as string;
      if (parentArgs) {
        for (const argNode of parentArgs) {
          content = content.replace(`{${argNode.name}}`, argNode.value);
        }
      }
    }
    return `\n${TAB}${indent}<${tag}${classAttr}${styleAttr}>${content}</${tag}>`;
  }

  private renderComponentRef(
    componentRef: ComponentRefNode,
    indent: string,
    parentArgs?: ComponentArgument[]): string {
    const componentDef = this.components.get(componentRef.name)
    if (!componentDef) {
      throw new Error(`Component ${componentRef.name} is not defined`)
    }

    const componentArguments = this.getComponentArguments(componentRef, componentDef, parentArgs);
    const componentChildrenToRender = this.getComponentChildNodesWithSlots(componentRef, componentDef);
    return this.renderComponentChildren(componentChildrenToRender, indent, componentArguments, componentRef.slotChildren);
  }

  private getComponentArguments(
    componentRef: ComponentRefNode,
    componentDef: ComponentDefinitionNode,
    parentArgs?: ComponentArgument[]): ComponentArgument[] {
    const currentNodeArgs: ComponentArgument[] = [];

    // Not args
    if (!componentDef.args || !componentDef.args.length) {
      return currentNodeArgs;
    }
    // Wrong args
    if (!componentRef.args || !componentRef.args.length || componentDef.args.length !== componentRef.args.length) {
      throw new Error(`Component ${componentRef.name} requires ${componentDef.args?.length} arguments, but ${componentRef.args?.length ?? 0} were provided`)
    }

    for (let i = 0; i < componentDef.args.length; i++) {
      const name = componentDef.args[i];
      const argNode = componentRef.args[i];

      // Direct value
      if (argNode.valueType === 'string') {
        currentNodeArgs.push({ name, value: argNode.value })
        continue;
      }

      // Value from parent
      const parantArg = parentArgs?.find((a) => a.name === argNode.value);
      const globaParam = this.parameters?.get(argNode.value);
      if (parantArg) {        
        currentNodeArgs.push({ name, value: parantArg.value })
      } else if (globaParam) {
        currentNodeArgs.push({ name, value: globaParam })
      } else {        
        throw new Error(`Argument ${argNode.value} is not defined`)
      }
    }
    return currentNodeArgs;
  }

  private getComponentChildNodesWithSlots(
    componentRef: ComponentRefNode,
    componentDef: ComponentDefinitionNode): ComponentChildNode[] {
    const componentRefChildren = componentRef.slotChildren;

    // No slots provided
    if (!componentRefChildren || !componentRefChildren.length) {
      return componentDef.children;
    }

    // No slots defined
    const componentDefChildren = [...componentDef.children];
    if (!componentDefChildren || !componentDefChildren.length) {
      return componentDef.children;
    }

    for (let i = 0; i < componentDefChildren.length; i++) {
      const child = componentDefChildren[i];
      if (child.type !== 'slotRef') {
        continue;
      }

      const slotNode = this.getComponentSlotDef(child, componentRefChildren);
      if (slotNode) {
        componentDefChildren[i] = slotNode;
      }
    }

    return componentDefChildren;
  }

  private getComponentSlotDef(slotRef: SlotRefNode, slotDefinitions?: ComponentChildNode[]): ComponentChildNode | undefined {
    if (!slotDefinitions) {
      return undefined;
    }

    const slotNode = slotDefinitions
      .find(node => {
        // Slot ref not supported
        if (node.type === 'slotRef') {
          return false;
        }
        // Search by name
        if (slotRef.name) {
          return node.slot === slotRef.name;
        }
        // Get the first with no name
        return !node.slot;
      });
    return slotNode;
  }
}