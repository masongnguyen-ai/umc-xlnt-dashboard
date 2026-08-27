export type DxfPt = { x: number; y: number; bulge?: number };

export type DxfEntity =
  | {
      type: "LINE";
      layer: string;
      color: number;
      x1: number;
      y1: number;
      x2: number;
      y2: number;
    }
  | {
      type: "CIRCLE";
      layer: string;
      color: number;
      cx: number;
      cy: number;
      r: number;
    }
  | {
      type: "ARC";
      layer: string;
      color: number;
      cx: number;
      cy: number;
      r: number;
      a1: number;
      a2: number;
    }
  | {
      type: "POLYLINE";
      layer: string;
      color: number;
      closed: boolean;
      pts: DxfPt[];
    }
  | {
      type: "TEXT";
      layer: string;
      color: number;
      x: number;
      y: number;
      h: number;
      rot: number;
      value: string;
    }
  | {
      type: "POINT";
      layer: string;
      color: number;
      x: number;
      y: number;
    }
  | {
      type: "INSERT";
      layer: string;
      color: number;
      x: number;
      y: number;
      name: string;
      rot: number;
      sx: number;
      sy: number;
    };

export type DxfLayer = {
  name: string;
  color: number;
  frozen: boolean;
};

export type DxfDoc = {
  version: string;
  layers: DxfLayer[];
  entities: DxfEntity[];
  extMin: { x: number; y: number };
  extMax: { x: number; y: number };
};

export type CadPin = {
  equipmentId: string;
  x: number;
  y: number;
  label?: string;
};

export type CadDrawingKind = "DXF" | "LINK" | "PLANT";

export type CadDrawingMeta = {
  id: string;
  name: string;
  kind: CadDrawingKind;
  heThong: "He_600" | "He_220" | "CHUNG";
  fileName: string;
  driveUrl: string;
  entityCount: number;
  pins: CadPin[];
  actorEmail: string;
  actorRole: string;
  createdAt: string;
  updatedAt: string;
};

export type CadDrawing = CadDrawingMeta & {
  dxfText: string;
};

export const MAX_DXF_CHARS = 1_800_000;

export const BYLAYER = 256;
