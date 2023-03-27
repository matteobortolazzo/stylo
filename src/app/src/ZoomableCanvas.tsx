import React, { FC, useState, useRef, useEffect } from "react";
import DOMPurify from "dompurify";
import { RenderResult } from "./compiler/StyloRenderer";

type ZoomableCanvasProps = {
  render: RenderResult;
  mouseEnter: (component?: string) => void;
};

const factor = 0.1;
const minScale = 0.2;
const maxScale = 6;
let zoomTarget = { x: 0, y: 0 };
let zoomPoint = { x: 0, y: 0 };

const ZoomableCanvas: FC<ZoomableCanvasProps> = ({ render, mouseEnter }) => {
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);

  function handleZoom(e: React.WheelEvent<HTMLDivElement>) {
    const container = e.currentTarget;
    const offset = container.getBoundingClientRect();
    zoomPoint.x = e.pageX - offset.left;
    zoomPoint.y = e.pageY - offset.top;

    // Cap the delta to [-1,1] for cross-browser consistency
    const delta = Math.max(-1, Math.min(1, -e.deltaY));

    // Determine the point on where the slide is zoomed in
    zoomTarget.x = (zoomPoint.x - pos.x) / scale;
    zoomTarget.y = (zoomPoint.y - pos.y) / scale;

    // Apply zoom
    const newScale = scale + delta * factor * scale;
    setScale(Math.max(minScale, Math.min(maxScale, newScale)));

    // Calculate x and y based on zoom
    const newPos = {
      x: -zoomTarget.x * newScale + zoomPoint.x,
      y: -zoomTarget.y * newScale + zoomPoint.y,
    };

    setPos(newPos);
  }

  function handlePanStart(event: React.MouseEvent<HTMLDivElement>) {
    const initialPosition = { x: event.clientX, y: event.clientY };

    function handlePanMove(event: MouseEvent) {
      const dx = event.clientX - initialPosition.x;
      const dy = event.clientY - initialPosition.y;
      setPos((prevCanvasPosition) => ({
        x: prevCanvasPosition.x + dx,
        y: prevCanvasPosition.y + dy,
      }));

      initialPosition.x = event.clientX;
      initialPosition.y = event.clientY;
    }

    function handlePanEnd() {
      document.removeEventListener("mousemove", handlePanMove);
      document.removeEventListener("mouseup", handlePanEnd);
    }

    document.addEventListener("mousemove", handlePanMove);
    document.addEventListener("mouseup", handlePanEnd);
  }

  useEffect(() => {    
    function handleMouseEnter(event: MouseEvent) {
      const target = event.target as HTMLElement;
      if (target.dataset.styloComponent) {
        mouseEnter(target.dataset.styloComponent);
      }
    }

    // get the container element
    const container = canvasRef.current;
    if (!container) {
      return;
    }
  
    // get the child elements
    const childElements = container.querySelectorAll("div[data-stylo-component]");
  
    // attach event listeners to the child elements
    childElements.forEach((childElement) => {
      childElement.addEventListener("mouseenter", handleMouseEnter as any);
    });
  
    // cleanup function to remove the event listeners
    return () => {
      childElements.forEach((childElement) => {
        childElement.removeEventListener("mouseenter", handleMouseEnter as any);
      });
    };
  }, [canvasRef, render, mouseEnter]);


  const components = render.renders.join("\n");
  const container = `<div style="display: flex; gap: 100px; padding: 50px">
    ${render.style}
    ${components}
  </div>`;
  const sanitizedHtml = DOMPurify.sanitize(container);

  return (
    <div
      id="canvasContainer"
      style={{
        userSelect: "none",
        cursor: "pointer",
        position: "relative",
        overflow: "hidden",
        width: "100%",
        height: "100%",
        backgroundColor: "#333333",
      }}
      onWheel={handleZoom}
      onMouseDown={handlePanStart}
    >
      <div
        id="canvas"
        ref={canvasRef}
        onMouseLeave={() => mouseEnter(undefined)}
        style={{
          transform: `translate(${pos.x}px, ${pos.y}px) translateZ(0) scale(${scale})`,
          transformOrigin: "0 0",
          position: "absolute",
          left: 0,
          top: 0,
        }}
        dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
      />
    </div>
  );
};

export default ZoomableCanvas;
