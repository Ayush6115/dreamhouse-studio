import type { RoomType } from '../types';

/** Plan fill colors per room type (used by the canvas AND the SVG export). */
export const ROOM_FILLS: Record<RoomType, string> = {
  bedroom: '#f0e6d8',
  kitchen: '#f5ead6',
  bathroom: '#dce9f0',
  living: '#eee8db',
  dining: '#f0e4de',
  pooja: '#f7f0da',
  balcony: '#e5efe0',
  parking: '#e8e8e4',
  garden: '#e0edd5',
  'boundary-wall': '#e5e2da',
  study: '#e9e4f0',
  store: '#ece7df',
  other: '#ebebe7',
};
