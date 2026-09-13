export type BuildingTypeId = 'small-house' | 'large-house' | 'shop';
export type RoofStyle = 'pyramid' | 'flat';

export interface BuildingTypeDef {
  id: BuildingTypeId;
  width: number; // footprint, world X
  depth: number; // footprint, world Z
  wallHeight: number;
  roofStyle: RoofStyle;
  roofHeight: number;
  wallColor: string;
  roofColor: string;
  doorWidth: number;
  doorHeight: number;
  windowWidth: number;
  windowHeight: number;
  /** How many window accents to place (not counting the door). */
  windowCount: number;
}

export const BUILDING_TYPES: Record<BuildingTypeId, BuildingTypeDef> = {
  'small-house': {
    id: 'small-house',
    width: 3,
    depth: 3,
    wallHeight: 2.2,
    roofStyle: 'pyramid',
    roofHeight: 1.6,
    wallColor: '#f6e3d3',
    roofColor: '#f4978e',
    doorWidth: 0.7,
    doorHeight: 1.5,
    windowWidth: 0.6,
    windowHeight: 0.6,
    windowCount: 1,
  },
  'large-house': {
    id: 'large-house',
    width: 4.5,
    depth: 4,
    wallHeight: 2.6,
    roofStyle: 'pyramid',
    roofHeight: 2.0,
    wallColor: '#fde4cf',
    roofColor: '#f08080',
    doorWidth: 0.8,
    doorHeight: 1.6,
    windowWidth: 0.6,
    windowHeight: 0.7,
    windowCount: 2,
  },
  shop: {
    id: 'shop',
    width: 5,
    depth: 3.5,
    wallHeight: 2.4,
    roofStyle: 'flat',
    roofHeight: 0.35,
    wallColor: '#e8f6ef',
    roofColor: '#a3c9a8',
    doorWidth: 0.9,
    doorHeight: 1.7,
    windowWidth: 2.4, // one big storefront window, per Build Spec
    windowHeight: 1.1,
    windowCount: 1,
  },
};

export const BUILDING_TYPE_IDS: BuildingTypeId[] = ['small-house', 'large-house', 'shop'];

/** Half the diagonal of the footprint — used for road-clearance and inter-building spacing checks. */
export function footprintHalfDiagonal(type: BuildingTypeDef): number {
  return Math.hypot(type.width, type.depth) / 2;
}
