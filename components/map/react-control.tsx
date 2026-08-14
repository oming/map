// ReactControl.tsx
import { createRoot, Root } from "react-dom/client";
import type { IControl, Map as MaplibreMap } from "maplibre-gl";
import React from "react";

export class ReactControl implements IControl {
  private container: HTMLDivElement | null = null;
  private root: Root | null = null;
  private component: React.ReactNode;

  constructor(component: React.ReactNode) {
    this.component = component;
  }

  onAdd(map: MaplibreMap): HTMLElement {
    this.container = document.createElement("div");
    // maplibre 기본 컨트롤 그룹 스타일을 쓰고 싶으면 아래 클래스 추가
    // this.container.className = "maplibregl-ctrl maplibregl-ctrl-group";
    this.container.className = "maplibregl-ctrl";
    this.container.style.pointerEvents = "auto"; // maplibregl-ctrl 대체

    const element = this.component as React.ReactElement;
    const mapProp = {
      ...(element.props as Record<string, unknown>),
      map,
    } as Record<string, unknown>;
    const mappedElement = React.createElement(element.type, mapProp);

    this.root = createRoot(this.container);
    this.root.render(mappedElement);
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
