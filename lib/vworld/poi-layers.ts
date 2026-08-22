import type { LayerSpecification } from "maplibre-gl";
import poiLayersRaw from "@/data/poi-layers.json";

/**
 * data/poi-layers.json은 V-World POI 스타일을 그대로 옮겨둔 것이라 MapLibre의
 * LayerSpecification 판별 유니온으로 추론되지 않는다(JSON import는 type/layout 같은
 * 판별 필드까지 전부 넓은 string으로 읽힌다). 단언은 이 파일 한 곳에서만 하고,
 * 스타일 생성(app/vworld.json)과 디버그 클릭 라우트(VWorldMap)는 타입이 붙은 값을 쓴다.
 */
export const POI_LAYERS = poiLayersRaw as unknown as LayerSpecification[];

export const POI_LAYER_IDS = POI_LAYERS.map((layer) => layer.id);
