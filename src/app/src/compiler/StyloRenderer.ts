import { TAB } from "./Constants";
import { ParamNode, ComponentDefinitionNode, ComponentChildNode, RenderNode } from "./StyloParser";
import { ClassNode } from "./StyloParser";
import { Node } from "./StyloParser";

type ComponentArgument = {
  name: string;
  value: string;
}

export type RenderResult = {
  style: string;
  components: string[];
}

export class StyloRenderer {
  private parameters = new Map<string, string>();
  private components = new Map<string, ComponentDefinitionNode>();

  constructor(private ast: Node[]) { }

  render(): RenderResult {  
    const style = this.renderStyleBlock();

    const componentDefinitionNodes = this.ast
      .filter((n) => n.type === "componentDef")
      .map((n) => n as ComponentDefinitionNode)

    for (const component of componentDefinitionNodes) {
      this.components.set(component.name, component);
    }

    const renders: string[] = [];
    for (const render of this.ast.filter(n => n.type === "render")) {
      const component = this.renderComponent(render as RenderNode);
      renders.push(component);
    }

    return {
      style,
      components: renders
    }
  }

  private renderStyleBlock(): string {
    const cssVariables = this.ast
    .filter((n) => n.type === "param")
    .map(n => this.renderParameters(n as ParamNode))
    .join("\n");
  const customClasses = this.ast
    .filter((n) => n.type === "class")
    .map(n => this.renderCustomClass(n as ClassNode))
    .join("\n");

    const styleContent = cssVariables ? `:root {\n${cssVariables}\n${TAB}${TAB}}` : "";
    return `<style>\n${TAB}${TAB}${styleContent}\n${TAB}${customClasses}\n${TAB}</style>`;
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
      }
    }

    return `  .${node.name} {
      ${cssProperties.join("\n      ")}
    }`;
  }
  
  private renderComponent(component: RenderNode): string {
    const content = this.renderComponentChild(component.child, TAB)
    return `<div style="position: relative" data-comp="${component.child.name}">${content}\n${TAB}</div>`;
  }

  private renderComponentChildren(
    children: ComponentChildNode[] | string,
    indent: string,
    parentArgs?: ComponentArgument[],
    parentSlots?: ComponentChildNode[]): string {

    if (typeof children === "string") {
      return children;
    }
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
      case "block": {
        return this.renderBlock(child, indent, parentArgs, parentSlots)
      }
      case "componentRef": {
        return this.renderComponentRef(child, indent, parentArgs);
      }
      case "slotRef": {
        return this.renderSlotRef(child, indent, parentArgs, parentSlots);
      }
      default:
        return "";
    }
  }

  private renderSlotRef(
    slotRef: ComponentChildNode,
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

  private renderBlock(
    block: ComponentChildNode,
    indent: string,
    parentArgs?: ComponentArgument[],
    parentSlots?: ComponentChildNode[]): string {

    function replaceWithArgs(input: string): string {
      if (parentArgs) {
        for (const argNode of parentArgs) {
          input = input.replace(`{${argNode.name}}`, argNode.value);
        }
      }
      return input;
    }

    const finalStyle = block.style ? replaceWithArgs(block.style)
      .split(';')
      .filter(s => s.trim().length > 0)
      .map(style => {
        const values = style.split(':');
        if (values[1].trim().startsWith('$')) {
          values[1] = `var(--${values[1].trim().substring(1)})`;
        }
        return values.join(':');
      })
      .join(';')
      : '';
    const styleAttr = block.style ? ` style="${finalStyle}"` : "";
    const classAttr = block.class ? ` class="${block.class}"` : "";

    let tag = '';
    let content = '';
    // Render child nodes
    if (Array.isArray(block.children)) {
      tag = 'div';
      const childrenContent = this.renderComponentChildren(block.children, indent + TAB, parentArgs, parentSlots);
      content = `\n${indent}${TAB}${TAB}${childrenContent}\n${indent}${TAB}`;
    }
    // Replace string templates
    else {
      tag = 'span';
      content = replaceWithArgs(block.children as string);
    }
    return `\n${TAB}${indent}<${tag}${classAttr}${styleAttr}>${content}</${tag}>`;
  }

  private renderComponentRef(
    componentRef: ComponentChildNode,
    indent: string,
    parentArgs?: ComponentArgument[]): string {
    const componentDef = this.components.get(componentRef.name!)
    if (!componentDef) {
      throw new Error(`Component ${componentRef.name} is not defined`)
    }

    const componentArguments = this.getComponentArguments(componentRef, componentDef, parentArgs);
    const componentChildrenToRender = this.getComponentChildNodesWithSlots(componentRef, componentDef);
    return this.renderComponentChildren(componentChildrenToRender, indent, componentArguments, componentRef.children as ComponentChildNode[]);
  }

  private getComponentArguments(
    componentRef: ComponentChildNode,
    componentDef: ComponentDefinitionNode,
    parentArgs?: ComponentArgument[]): ComponentArgument[] {
    const currentNodeArgs: ComponentArgument[] = [];
    // No args
    if (!componentDef.args.length && componentRef.args!.length) {
      return currentNodeArgs;
    }

    // Wrong args
    if (componentDef.args.length !== componentRef.args!.length) {
      throw new Error(`Component ${componentRef.name} requires ${componentDef.args?.length} arguments, but ${componentRef.args?.length ?? 0} were provided`)
    }

    for (let i = 0; i < componentDef.args!.length; i++) {
      const name = componentDef.args![i];
      const argNode = componentRef.args![i];

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
    componentRef: ComponentChildNode,
    componentDef: ComponentDefinitionNode): ComponentChildNode[] {
    const componentRefChildren = componentRef.children;

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

      const slotNode = this.getComponentSlotDef(child, componentRefChildren as ComponentChildNode[]);
      if (slotNode) {
        componentDefChildren[i] = slotNode;
      }
    }

    return componentDefChildren;
  }

  private getComponentSlotDef(slotRef: ComponentChildNode, slotDefinitions?: ComponentChildNode[]): ComponentChildNode | undefined {
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