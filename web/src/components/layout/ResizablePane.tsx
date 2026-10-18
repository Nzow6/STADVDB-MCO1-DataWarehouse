import React, { useState, useRef, useCallback } from 'react';

interface ResizablePaneProps {
  leftContent: React.ReactNode;
  centerContent: React.ReactNode;
  rightContent: React.ReactNode;
  showLeftPane?: boolean;
}

export const ResizablePane: React.FC<ResizablePaneProps> = ({
  leftContent,
  centerContent,
  rightContent,
  showLeftPane = true,
}) => {
  // Widths in percentages
  const [leftWidth, setLeftWidth] = useState(20);
  const [rightWidth, setRightWidth] = useState(25);

  const isDraggingLeft = useRef(false);
  const isDraggingRight = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const startDraggingLeft = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingLeft.current = true;
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, []);

  const startDraggingRight = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRight.current = true;
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, []);

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const totalWidth = rect.width;

    if (isDraggingLeft.current) {
      const newLeftPx = e.clientX - rect.left;
      const newLeftPct = Math.min(35, Math.max(14, (newLeftPx / totalWidth) * 100));
      setLeftWidth(newLeftPct);
    } else if (isDraggingRight.current) {
      const newRightPx = rect.right - e.clientX;
      const newRightPct = Math.min(40, Math.max(18, (newRightPx / totalWidth) * 100));
      setRightWidth(newRightPct);
    }
  }, []);

  const onMouseUp = useCallback(() => {
    isDraggingLeft.current = false;
    isDraggingRight.current = false;
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  }, [onMouseMove]);

  const effectiveLeftWidth = showLeftPane ? leftWidth : 0;
  const centerWidth = 100 - effectiveLeftWidth - rightWidth;

  return (
    <div ref={containerRef} className="flex-1 flex overflow-hidden relative select-none bg-white">
      {/* Left Pane: Schema & Cube Navigator (Only visible when Visual Builder is active) */}
      {showLeftPane && (
        <>
          <div
            style={{ width: `${leftWidth}%` }}
            className="h-full flex flex-col bg-slate-50 border-r border-slate-200 overflow-hidden"
          >
            {leftContent}
          </div>

          {/* Left Resize Handle */}
          <div
            onMouseDown={startDraggingLeft}
            className="w-1 hover:w-1.5 bg-slate-200 hover:bg-emerald-600 cursor-col-resize transition-colors z-20"
            title="Resize Left Pane"
          />
        </>
      )}

      {/* Center Pane: Query Authoring & Execution */}
      <div
        style={{ width: `${centerWidth}%` }}
        className="h-full flex flex-col bg-white overflow-hidden"
      >
        {centerContent}
      </div>

      {/* Right Resize Handle */}
      <div
        onMouseDown={startDraggingRight}
        className="w-1 hover:w-1.5 bg-slate-200 hover:bg-emerald-600 cursor-col-resize transition-colors z-20"
        title="Resize Right Pane"
      />

      {/* Right Pane: Slice, Dice, Pivot & Dynamic Parameters */}
      <div
        style={{ width: `${rightWidth}%` }}
        className="h-full flex flex-col bg-slate-50 border-l border-slate-200 overflow-hidden"
      >
        {rightContent}
      </div>
    </div>
  );
};
