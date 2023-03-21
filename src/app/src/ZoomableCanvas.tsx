import React, { FC, useState } from 'react';
import DOMPurify from 'dompurify';

type ZoomableCanvasProps = {
  source: string;
}

const ZoomableCanvas: FC<ZoomableCanvasProps> = ({ source }) => {
  const [scale, setScale] = useState(1);
  const [translateX, setTranslateX] = useState(0);
  const [translateY, setTranslateY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [lastMousePosition, setLastMousePosition] = useState({ x: 0, y: 0 });

  const handleMouseWheel = (e: any) => {
    e.preventDefault();
    const newScale = Math.max(0.1, Math.min(5, scale + e.deltaY * -0.01));
    setScale(newScale);
  };

  const handleMouseDown = (e: any) => {
    setDragging(true);
    setLastMousePosition({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: any) => {
    if (!dragging) return;

    const deltaX = e.clientX - lastMousePosition.x;
    const deltaY = e.clientY - lastMousePosition.y;
    setTranslateX(translateX + deltaX);
    setTranslateY(translateY + deltaY);
    setLastMousePosition({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => {
    setDragging(false);
  };

  const containerStyle = {
    transform: `translate(${translateX}px, ${translateY}px) scale(${scale})`,
  };

  const sanitizedHtml = DOMPurify.sanitize(source);

  return (
    <div
      className="zoomable-canvas"
      onWheel={handleMouseWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <div
        className="canvas-content"
        style={containerStyle}
        dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
      ></div>
    </div>
  );
};

export default ZoomableCanvas;
