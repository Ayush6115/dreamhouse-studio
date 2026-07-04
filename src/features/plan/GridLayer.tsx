import { Layer, Shape } from 'react-konva';
import type { Viewport } from './viewport';

interface Props {
  viewport: Viewport;
  width: number;
  height: number;
  gridSize: number;
}

const MINOR = '#e5e0d3';
const MAJOR = '#d5cebc';
const AXIS = '#bdb298';

/**
 * Adaptive drafting grid. Drawn in world coordinates inside the transformed
 * stage; minor lines fade out when they would be denser than ~9 px.
 */
export function GridLayer({ viewport, width, height, gridSize }: Props) {
  return (
    <Layer listening={false}>
      <Shape
        sceneFunc={(ctx) => {
          const { x, y, scale } = viewport;
          const x0 = -x / scale;
          const y0 = -y / scale;
          const x1 = (width - x) / scale;
          const y1 = (height - y) / scale;

          const px = 1 / scale; // one screen pixel in world units
          const minor = gridSize > 0 ? gridSize : 0.5;
          const majorEvery = 5;
          const showMinor = minor * scale >= 9;

          const step = showMinor ? minor : minor * majorEvery;
          const startX = Math.floor(x0 / step) * step;
          const startY = Math.floor(y0 / step) * step;

          ctx.beginPath();
          for (let gx = startX; gx <= x1; gx += step) {
            const isMajor = Math.abs(gx / (minor * majorEvery) - Math.round(gx / (minor * majorEvery))) < 1e-6;
            if (showMinor && !isMajor) {
              ctx.moveTo(gx, y0);
              ctx.lineTo(gx, y1);
            }
          }
          for (let gy = startY; gy <= y1; gy += step) {
            const isMajor = Math.abs(gy / (minor * majorEvery) - Math.round(gy / (minor * majorEvery))) < 1e-6;
            if (showMinor && !isMajor) {
              ctx.moveTo(x0, gy);
              ctx.lineTo(x1, gy);
            }
          }
          ctx.strokeStyle = MINOR;
          ctx.lineWidth = px;
          ctx.stroke();

          const majorStep = minor * majorEvery;
          ctx.beginPath();
          for (let gx = Math.floor(x0 / majorStep) * majorStep; gx <= x1; gx += majorStep) {
            ctx.moveTo(gx, y0);
            ctx.lineTo(gx, y1);
          }
          for (let gy = Math.floor(y0 / majorStep) * majorStep; gy <= y1; gy += majorStep) {
            ctx.moveTo(x0, gy);
            ctx.lineTo(x1, gy);
          }
          ctx.strokeStyle = MAJOR;
          ctx.lineWidth = px;
          ctx.stroke();

          // Origin axes.
          ctx.beginPath();
          ctx.moveTo(x0, 0);
          ctx.lineTo(x1, 0);
          ctx.moveTo(0, y0);
          ctx.lineTo(0, y1);
          ctx.strokeStyle = AXIS;
          ctx.lineWidth = 1.5 * px;
          ctx.stroke();
        }}
      />
    </Layer>
  );
}
