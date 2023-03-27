import { TAB } from "./Constants";
import { ImportNode, ParamNode, ClassNode, ComponentDefinitionNode, ComponentChildNode, RenderNode, CodePosition } from "./StyloParser";
import { Node } from "./StyloParser";

type ComponentArgument = {
  name: string;
  value: string;
}

export type RenderResult = {
  style: string;
  renders: string[];
  components: Record<string, CodePosition>;
}

export class StyloRenderer {
  private parameters = new Map<string, string>();
  private components = new Map<string, ComponentDefinitionNode>();
  private ast: Node[] = [];

  render(ast: Node[]): RenderResult {
    this.ast = ast;

    const importNodes: ImportNode[] = [];
    const paramNodes: ParamNode[] = [];
    const classNodes: ClassNode[] = [];
    const componentDefNodes: ComponentDefinitionNode[] = [];
    const renderNodes: RenderNode[] = [];

    for (const node of this.ast) {
      if (node.type === 'import')
        importNodes.push(node as ImportNode);
      else if (node.type === 'param')
        paramNodes.push(node as ParamNode);
      else if (node.type === 'class')
        classNodes.push(node as ClassNode);
      else if (node.type === 'componentDef')
        componentDefNodes.push(node as ComponentDefinitionNode);
      else if (node.type === 'render')
        renderNodes.push(node as RenderNode);
    }

    const style = this.renderStyleBlock(paramNodes, classNodes);

    for (const component of componentDefNodes) {
      this.components.set(component.name, component);
    }

    this.ast = [];
    const components: Record<string, CodePosition> = componentDefNodes.reduce((acc, curr) => {
      (acc as any)[curr.name] = curr.position
      return acc;
    }, {});
    return {
      style,
      renders: renderNodes.map(n => this.renderComponent(n)),
      components
    }
  }

  private renderStyleBlock(paramNodes: ParamNode[], classNodes: ClassNode[]): string {
    const cssVariables = paramNodes.map(n => this.renderParameters(n)).join("\n");
    const customClasses = classNodes.map(n => this.renderCustomClass(n)).join("\n") + this.getColorClasses(paramNodes);

    const styleContent = cssVariables ? `:root {\n${cssVariables}\n${TAB}${TAB}}` : "";
    return `<style>\n${TAB}${TAB}${styleContent}\n${TAB}${customClasses}\n${TAB}</style>`;
  }

  private getColorClasses(paramNodes: ParamNode[]): string {
    let colorClasses = ''
    const colors = paramNodes
      .filter(node => node.name.endsWith("Color"))
      .map(node => ({
        name: node.name.substring(0, node.name.length - 5),
        var: node.name,
      }));
    for (const color of colors) {
      colorClasses += `  
  .border-${color.name} {
    border-color: var(--${color.var});
  }
  .border-y-${color.name} {
    border-top-color: var(--${color.var});
    border-bottom-color: var(--${color.var});
  }
  .border-x-${color.name} {
    border-right-color: var(--${color.var});
    border-left-color: var(--${color.var});
  }
  .border-t-${color.name} {
    border-top-color: var(--${color.var});
  }
  .border-r-${color.name} {
    border-right-color: var(--${color.var});
  }
  .border-b-${color.name} {
    border-bottom-color: var(--${color.var});
  }
  .border-k-${color.name} {
    border-left-color: var(--${color.var});
  }
  .color-${color.name} {
    color: var(--${color.var});
  }
  .bg-${color.name} {
    background-color: var(--${color.var});
  }
  .outline-${color.name} {
    outline-color: var(--${color.var});
  }`;
    }
    return colorClasses;
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
    return `<div style="position: relative">${content}\n${TAB}</div>`;
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
      content = this.replaceWithArgs(block.children as string, parentArgs);
    }
    const attributes = this.getStyleAttributes(block.style, block.class, parentArgs);
    return `\n${TAB}${indent}<${tag} data-stylo-block="${block.name}"${attributes.class}${attributes.style}>${content}</${tag}>`;
  }

  private renderComponentRef(
    componentRef: ComponentChildNode,
    indent: string,
    parentArgs?: ComponentArgument[]): string {
    const componentDef = this.components.get(componentRef.name!)
    if (!componentDef) {
      throw new Error(`Component ${componentRef.name} is not defined`)
    }

    const attributes = this.getStyleAttributes(componentRef.style, componentRef.class, parentArgs);
    const componentArguments = this.getComponentArguments(componentRef, componentDef, parentArgs);
    const componentChildrenToRender = this.getComponentChildNodesWithSlots(componentRef, componentDef);
    const childrenRender = this.renderComponentChildren(componentChildrenToRender, indent, componentArguments, componentRef.children as ComponentChildNode[]);
    return `<div data-stylo-component="${componentRef.name}"${attributes.class}${attributes.style}>\n${indent}${TAB}${childrenRender}\n${indent}</div>`;
  }

  private getStyleAttributes(styleValue?: string, classValue?: string, parentArgs?: ComponentArgument[]): { style: string, class: string } {
    const finalStyle = styleValue ? this.replaceWithArgs(styleValue, parentArgs)
      .split(';')
      .filter(s => s.trim().length > 0)
      .map(s => {
        const values = s.split(':');
        if (values[1].trim().startsWith('$')) {
          values[1] = `var(--${values[1].trim().substring(1)})`;
        }
        return values.join(':');
      })
      .join(';')
      : '';
    return {
      style: styleValue ? ` style="${finalStyle}"` : "",
      class: classValue ? ` class="${classValue}"` : ""
    };
  }

  private replaceWithArgs(input: string, parentArgs?: ComponentArgument[]): string {
    if (parentArgs) {
      for (const argNode of parentArgs) {
        input = input.replace(`{${argNode.name}}`, argNode.value);
      }
    }
    return input;
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