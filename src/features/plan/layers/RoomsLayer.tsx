import { Group, Line, Text } from 'react-konva';
import { VertexHandle } from '../VertexHandle';
import type { RoomElement } from '../../../types';
import { isRoom } from '../../../types';
import { useDesignStore } from '../../../store/designStore';
import { polygonArea, polygonBounds, polygonCentroid } from '../../../geometry/polygon';
import { formatArea, formatLength } from '../../../geometry/units';
import { ROOM_FILLS } from '../../../library/roomColors';

interface Props {
  vpScale: number;
}

export function RoomsLayer({ vpScale }: Props) {
  const level = useDesignStore((s) => s.doc.levels.find((l) => l.id === s.activeLevelId));
  const unit = useDesignStore((s) => s.doc.unitSystem);
  const selectedIds = useDesignStore((s) => s.selectedIds);
  const tool = useDesignStore((s) => s.tool);
  if (!level) return null;

  const rooms = level.elements.filter(isRoom);

  return (
    <Group>
      {rooms.map((room: RoomElement) => {
        if (room.boundary.length < 3 || room.visible === false) return null;
        const flat = room.boundary.flatMap((p) => [p.x, p.y]);
        const c = polygonCentroid(room.boundary);
        const area = polygonArea(room.boundary);
        const rb = polygonBounds(room.boundary);
        const sizeLabel = `${formatLength(rb.max.x - rb.min.x, unit, 1)} × ${formatLength(rb.max.y - rb.min.y, unit, 1)}`;
        const selected = selectedIds.includes(room.id);
        return (
          <Group key={room.id}>
            <Line
              points={flat}
              closed
              fill={ROOM_FILLS[room.roomType]}
              stroke={selected ? '#2f6fee' : '#c9c2b4'}
              strokeWidth={selected ? 2 : 1}
              strokeScaleEnabled={false}
              elementId={room.id}
            />
            <Group x={c.x} y={c.y} listening={false}>
              <Text
                text={room.name}
                fontSize={12.5 / vpScale}
                fontStyle="600"
                fill="#57503f"
                width={6}
                x={-3}
                y={-14 / vpScale}
                align="center"
              />
              <Text
                text={sizeLabel}
                fontSize={10.5 / vpScale}
                fill="#6f6857"
                width={6}
                x={-3}
                y={1 / vpScale}
                align="center"
              />
              <Text
                text={formatArea(area, unit)}
                fontSize={9.5 / vpScale}
                fill="#8a8272"
                width={6}
                x={-3}
                y={14 / vpScale}
                align="center"
              />
            </Group>
            {selected &&
              tool === 'select' &&
              room.boundary.map((p, i) => (
                <VertexHandle
                  key={i}
                  x={p.x}
                  y={p.y}
                  vpScale={vpScale}
                  elementId={room.id}
                  handle={{ kind: 'room-vertex', index: i }}
                />
              ))}
          </Group>
        );
      })}
    </Group>
  );
}
