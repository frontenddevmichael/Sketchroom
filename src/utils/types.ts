export interface BlockDef {
  label: string;
  code: string;
  kind: string;
  role?: string;
}

export interface CameraState {
  x: number;
  y: number;
  z: number;
}