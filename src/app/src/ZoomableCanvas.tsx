import React, { FC, useState, useRef } from "react";
import DOMPurify from "dompurify";
import { RenderResult } from "./compiler/StyloRenderer";

type ZoomableCanvasProps = {
  render: RenderResult;
};

const factor = 0.1;
const minScale = 0.2;
const maxScale = 6;
let zoomTarget = { x: 0, y: 0 };
let zoomPoint = { x: 0, y: 0 };

const ZoomableCanvas: FC<ZoomableCanvasProps> = ({ render }) => {
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);

  function handleZoom(e: React.WheelEvent<HTMLDivElement>) {
    const container = e.currentTarget;
    const target = canvasRef.current!;
    const size = {
      w: target.getBoundingClientRect().width,
      h: target.getBoundingClientRect().height,
    };

    const offset = container.getBoundingClientRect();
    zoomPoint.x = e.pageX - offset.left;
    zoomPoint.y = e.pageY - offset.top;

    e.preventDefault();

    // cap the delta to [-1,1] for cross-browser consistency
    const delta = Math.max(-1, Math.min(1, -e.deltaY));

    // determine the point on where the slide is zoomed in
    zoomTarget.x = (zoomPoint.x - pos.x) / scale;
    zoomTarget.y = (zoomPoint.y - pos.y) / scale;

    // apply zoom
    const newScale = scale + delta * factor * scale;
    setScale(Math.max(minScale, Math.min(maxScale, newScale)));

    // calculate x and y based on zoom
    const newPos = {
      x: -zoomTarget.x * newScale + zoomPoint.x,
      y: -zoomTarget.y * newScale + zoomPoint.y,
    };

    // Make sure the slide stays in its container area when zooming out
    if (newPos.x > 0) newPos.x = 0;
    if (newPos.x + size.w * newScale < size.w)
      newPos.x = -size.w * (newScale - 1);
    if (newPos.y > 0) newPos.y = 0;
    if (newPos.y + size.h * newScale < size.h)
      newPos.y = -size.h * (newScale - 1);

    setPos(newPos);
  }

  function handlePanStart(event: React.MouseEvent<HTMLDivElement>) {
    const initialPosition = { x: event.clientX, y: event.clientY };

    function handlePanMove(event: MouseEvent) {
      const dx = (event.clientX - initialPosition.x) / scale;
      const dy = (event.clientY - initialPosition.y) / scale;

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

  const components = render.components.join("\n");
  const container = `<div style="display: flex; gap: 100px">
    ${render.style}
    ${components}
  </div>`;
  const sanitizedHtml = DOMPurify.sanitize(container);

  return (
    <div
      id="canvasContainer"
      style={{
        position: "relative",
        overflow: "hidden",
        width: "100%",
        height: "100%",
      }}
      onWheel={handleZoom}
      onMouseDown={handlePanStart}
    >
      <div
        id="canvas"
        ref={canvasRef}
        style={{
          transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})`,
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
