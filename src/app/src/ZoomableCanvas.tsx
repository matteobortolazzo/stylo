import { FC, useState } from "react";
import DOMPurify from "dompurify";
import { RenderResult } from "./compiler/StyloRenderer";

type ZoomableCanvasProps = {
  render: RenderResult;
};

const ZoomableCanvas: FC<ZoomableCanvasProps> = ({ render: source }) => {
  const [zoom, setZoom] = useState(1);
  const [canvasPosition, setCanvasPosition] = useState({ x: 0, y: 0 });

  function handleZoom(event: any) {  
    const container = event.currentTarget;
    const canvas = container.firstChild;
  
    const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1;
  
    setZoom((prevZoom) => {
      const newZoom = Math.min(Math.max(0.1, prevZoom * zoomFactor), 3);
      const scaleFactor = newZoom / prevZoom;
  
      const containerRect = container.getBoundingClientRect();
      const cursorX = event.clientX - containerRect.left;
      const cursorY = event.clientY - containerRect.top;
  
      const canvasRect = canvas.getBoundingClientRect();
      const relX = (cursorX - canvasRect.left) / canvasRect.width;
      const relY = (cursorY - canvasRect.top) / canvasRect.height;
  
      const offsetX = canvasRect.width * (scaleFactor - 1) * relX;
      const offsetY = canvasRect.height * (scaleFactor - 1) * relY;
  
      setCanvasPosition((prevCanvasPosition) => ({
        x: prevCanvasPosition.x - offsetX,
        y: prevCanvasPosition.y - offsetY,
      }));
  
      return newZoom;
    });
  }  

  function handlePanStart(event: any) {
    const initialPosition = { x: event.clientX, y: event.clientY };
  
    function handlePanMove(event: any) {
      const dx = (event.clientX - initialPosition.x) / zoom;
      const dy = (event.clientY - initialPosition.y) / zoom;
  
      setCanvasPosition((prevCanvasPosition) => ({
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

  const sanitizedHtml = DOMPurify.sanitize(source);

  return (
    <div
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
        style={{
          transform: `scale(${zoom}) translate(${canvasPosition.x}px, ${canvasPosition.y}px) translateZ(0)`,
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
