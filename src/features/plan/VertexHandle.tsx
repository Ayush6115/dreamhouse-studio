import { useState } from 'react';
import { Circle } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';

interface Props {
  x: number;
  y: number;
  vpScale: number;
  /** Accent color (stroke; fill when emphasized). */
  color?: string;
  /** Render filled (e.g. vertex is part of a multi-selection). */
  emphasized?: boolean;
  elementId: string;
  handle: { kind: string; [key: string]: unknown };
}

/**
 * Draggable vertex handle with hover affordance: grows, tints and switches
 * the cursor to "grab" so users can tell it's editable before clicking.
 */
export function VertexHandle({ x, y, vpScale, color = '#2f6fee', emphasized = false, elementId, handle }: Props) {
  const [hover, setHover] = useState(false);
  const setCursor = (e: KonvaEventObject<MouseEvent>, cursor: string) => {
    const container = e.target.getStage()?.container();
    if (container) container.style.cursor = cursor;
  };
  return (
    <Circle
      x={x}
      y={y}
      radius={(emphasized ? 6.5 : hover ? 7.5 : 5.5) / vpScale}
      fill={emphasized ? color : hover ? '#dbe9ff' : '#ffffff'}
      stroke={color}
      strokeWidth={hover ? 2.2 : 1.5}
      strokeScaleEnabled={false}
      hitStrokeWidth={10 / vpScale}
      elementId={elementId}
      handle={handle}
      onMouseEnter={(e) => {
        setHover(true);
        setCursor(e, 'grab');
      }}
      onMouseLeave={(e) => {
        setHover(false);
        setCursor(e, '');
      }}
      onMouseDown={(e) => setCursor(e, 'grabbing')}
      onMouseUp={(e) => setCursor(e, 'grab')}
    />
  );
}
