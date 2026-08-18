import type { DataLayerDef } from "./types";
import { wifiSuwonLayer } from "./wifi";
import { toiletSuwonLayer } from "./toilet";

// 새 데이터셋 추가 = 이 배열에 한 줄 + lib/map/datasets/<new>.ts 파일 하나.
// 엔진(hooks/use-data-layers.ts)과 UI 컴포넌트는 이 배열만 읽으므로 수정할 필요 없다.
export const DATA_LAYERS: DataLayerDef[] = [wifiSuwonLayer, toiletSuwonLayer];

export function getDataLayer(id: string): DataLayerDef | undefined {
  return DATA_LAYERS.find((layer) => layer.id === id);
}

export type { DataLayerDef, SourceSpec, ClusterSpec } from "./types";
