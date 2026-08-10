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
    const mapProp = { ...element.props, map } as React.ComponentProps<
      typeof element.type
    >;
    const mappedElement = React.createElement(element.type, mapProp);

    this.root = createRoot(this.container);
    this.root.render(mappedElement);
    return this.container;
  }
  // onAdd(map: MaplibreMap): HTMLElement {
  //   this.container = document.createElement("div");
  //   this.root = createRoot(this.container);
  //   this.root.render(
  //     React.cloneElement(this.component as React.ReactElement, { map }),
  //   );
  //   return this.container;
  // }

  onRemove(): void {
    // this.root?.unmount();
    this.container?.parentNode?.removeChild(this.container);
    this.container = null;
    this.root = null;

    // React 렌더링 사이클과 충돌하지 않도록 unmount를 다음 tick으로 지연
    setTimeout(() => {
      this.root?.unmount();
      this.container?.parentNode?.removeChild(this.container);
    }, 0);
  }
}
