export interface SymbolStyle {
  symbolImageCn?: string;
  [key: string]: unknown;
}

export interface StyleEntry {
  symbolStyle?: SymbolStyle;
  [key: string]: unknown;
}

export type StyleData = Record<string, StyleEntry>;

export interface IconImage {
  id: string;
  width: number;
  height: number;
  buffer: Buffer;
}

export interface SpriteEntry {
  x: number;
  y: number;
  width: number;
  height: number;
  pixelRatio: number;
}

export type SpriteJson = Record<string, SpriteEntry>;
