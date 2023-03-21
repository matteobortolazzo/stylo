import React, { FC, useState, useRef } from "react";
import DOMPurify from "dompurify";

type ZoomableCanvasProps = {
  html: string;
};

const ZoomableCanvas: FC<ZoomableCanvasProps> = ({ html: source }) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [canvasPosition, setCanvasPosition] = useState({ x: 0, y: 0 });

  function handleZoom(event: any) {
    const cursorPosition = getCursorPosition(event);
    const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.min(Math.max(0.1, zoom * zoomFactor), 3);
    const zoomDelta = newZoom - zoom;
    setZoom(newZoom);
    setCanvasPosition({
      x: canvasPosition.x + cursorPosition.x * zoomDelta,
      y: canvasPosition.y + cursorPosition.y * zoomDelta,
    });
  }

  function handlePanStart(event: any) {
    // Store the initial position of the mouse pointer
    const initialPosition = { x: event.clientX, y: event.clientY };

    function handlePanMove(event: any) {
      // Calculate the distance the mouse has moved since the pan started
      const dx = event.clientX - initialPosition.x;
      const dy = event.clientY - initialPosition.y;

      // Update the canvas position accordingly
      setCanvasPosition({ x: canvasPosition.x + dx, y: canvasPosition.y + dy });
    }

    function handlePanEnd() {
      // Remove the event listeners
      document.removeEventListener("mousemove", handlePanMove);
      document.removeEventListener("mouseup", handlePanEnd);
    }

    // Add event listeners to handle the panning
    document.addEventListener("mousemove", handlePanMove);
    document.addEventListener("mouseup", handlePanEnd);
  }

  function getCursorPosition(event: any) {
    const canvas = canvasRef.current!;
    const canvasRect = canvas.getBoundingClientRect();
    const cursorX = (event.clientX - canvasRect.left) / zoom;
    const cursorY = (event.clientY - canvasRect.top) / zoom;
    return { x: cursorX, y: cursorY };
  }

  const sanitizedHtml = DOMPurify.sanitize(source);
  const scaledHtml = `<div style="transform: scale(${zoom}) translate(${canvasPosition.x}px, ${canvasPosition.y}px) translateZ(0); position: absolute; left: 0; top: 0;">${sanitizedHtml}</div>`;

  return (
    <div
      ref={canvasRef}
      style={{
        position: "relative",
        overflow: "hidden",
        width: "100%",
        height: "100%",
      }}
      onWheel={handleZoom}
      onMouseDown={handlePanStart}
      dangerouslySetInnerHTML={{ __html: scaledHtml }}
    />
  );
};

export default ZoomableCanvas;
