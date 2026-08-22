import { createRoot, Root } from "react-dom/client";
import React from "react";
import type { IControl, Map as MaplibreMap } from "maplibre-gl";

/**
 * React 컴포넌트를 MapLibre 컨트롤로 감싼다.
 *
 * MapLibre는 onAdd(map)에서야 map 인스턴스를 넘겨주므로 컴포넌트는 자기 전용 React
 * 루트에서 렌더되고 map은 그 시점에 prop으로 주입된다. 그래서 이 컨트롤 안의 UI는
 * <VWorldMap>의 React 트리 **밖**에 있다 — MapContext(useMap/useStyleReady)를 쓸 수 없고,
 * 지도 위 다른 오버레이와 위치가 겹치는지도 서로 알지 못한다(components/map/data/layer-toggle.tsx).
 */
export class ReactControl<P extends { map: MaplibreMap }> implements IControl {
  private container: HTMLDivElement | null = null;
  private root: Root | null = null;

  constructor(
    private readonly Component: React.ComponentType<P>,
    private readonly props: Omit<P, "map">,
  ) {}

  onAdd(map: MaplibreMap): HTMLElement {
    this.container = document.createElement("div");
    this.container.className = "maplibregl-ctrl";
    // maplibregl-ctrl 자체는 pointer-events를 켜주지 않는다 — 안에 든 React UI가
    // 클릭을 받으려면 직접 켜야 한다.
    this.container.style.pointerEvents = "auto";

    this.root = createRoot(this.container);
    this.root.render(
      React.createElement(this.Component, { ...this.props, map } as P),
    );
    return this.container;
  }

  onRemove(): void {
    // map.remove()가 React effect cleanup 도중(=React가 아직 렌더링/커밋 중인 시점)
    // 동기 호출될 수 있어, 같은 틱에서 root.unmount()를 호출하면 React가
    // "Attempted to synchronously unmount a root while React was already
    // rendering" 경고와 함께 충돌한다. 현재 렌더 사이클이 끝난 뒤 언마운트하도록
    // 다음 태스크로 미룬다.
    const root = this.root;
    const container = this.container;
    this.root = null;
    this.container = null;
    setTimeout(() => {
      root?.unmount();
      container?.parentNode?.removeChild(container);
    }, 0);
  }
}
