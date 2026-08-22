"use client";

import { ExternalLink } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface DetailFieldOverride {
  /** 없으면 속성 키에서 자동 유도한다(camelCase/snake_case → Title Case). 대부분의
   *  사용자 노출 필드는 한국어 라벨을 직접 지정하는 게 좋다 — 자동 라벨은 안전망이다. */
  label?: string;
  /** value가 null/undefined/""면 format을 호출하지 않고 필드를 숨긴다. */
  format?: (value: unknown) => string;
  /** true면 이 속성은 자동 노출/팝업 어디에도 나타나지 않는다. */
  hidden?: boolean;
  /** 기본 순서(속성 선언 순)를 조정하고 싶을 때만 지정. 낮을수록 먼저 나온다. */
  order?: number;
}

export interface DetailLinkSchema {
  label: string;
  /** DATA_LAYERS는 서로 다른 데이터셋이 섞인 배열이라 properties가 넓은 타입으로 들어온다.
   *  어느 데이터셋의 feature인지는 호출 지점이 보장하므로, 각 href 안에서 한 번만 좁힌다. */
  href: (properties: Record<string, unknown>) => string;
}

export interface DetailFieldsSchema {
  titleKey: string;
  /** 특별 취급(라벨/포맷/숨김/순서)이 필요한 속성만 등록한다. 등록되지 않은 속성은
   *  원본 그대로 자동 노출된다 — 화이트리스트가 아니라 예외 목록이다. */
  overrides?: Record<string, DetailFieldOverride>;
  /** overrides 없이 그냥 숨길 내부 필드(id, 링크 클로저가 읽는 키 등). links[].href
   *  같은 클로저가 읽는 속성은 정적으로 감지할 수 없으므로 여기에 직접 나열해야 한다. */
  hiddenKeys?: string[];
  links?: DetailLinkSchema[];
  /** 팝업(마커 클릭 시 첫 화면)에 보여줄 속성 키. 생략하면 자동 노출 대상 중 앞에서부터
   *  몇 개를 기본값으로 쓴다(POPUP_FIELD_LIMIT, detail-popup.tsx). */
  popupFields?: string[];
}

/**
 * 데이터셋의 GeoJSON properties 타입에 맞춰 스키마의 키를 검사한다.
 *
 * 키 오타는 전부 조용히 무시된다 — override가 안 걸려 자동 라벨이 나오거나, 숨기려던
 * 내부 필드가 그대로 노출된다. 그래서 각 데이터셋 정의에서
 * `satisfies DetailFieldsSchemaFor<XxxProperties>`로 못을 박는다.
 */
export type DetailFieldsSchemaFor<P> = {
  titleKey: keyof P & string;
  overrides?: { [K in keyof P & string]?: DetailFieldOverride };
  hiddenKeys?: (keyof P & string)[];
  links?: DetailLinkSchema[];
  popupFields?: (keyof P & string)[];
};

export interface ResolvedDetailField {
  key: string;
  label: string;
  display: string;
}

export interface ResolvedDetailLink {
  label: string;
  href: string;
}

function formatValue(
  value: unknown,
  format?: (value: unknown) => string,
): string | null {
  if (value == null || value === "") return null;
  return format ? format(value) : String(value);
}

/** openHours → "Open Hours" 같은 안전망 라벨. 실제 사용자 노출 필드는 overrides로
 *  한국어 라벨을 직접 지정하는 게 기본이고, 이건 미처 등록 안 한 필드를 위한 폴백이다. */
function autoLabel(key: string): string {
  const spaced = key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim();
  if (!spaced) return key;
  return spaced.replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * properties에서 실제로 렌더링할 필드 목록을 계산한다. Sheet(전체)와 Popup(일부)이
 * 이 함수 하나를 공유해 라벨/포맷/숨김/순서 규칙이 어긋나지 않게 한다.
 */
export function resolveDetailFields(
  properties: Record<string, unknown>,
  schema: DetailFieldsSchema,
  options?: { onlyKeys?: string[] },
): ResolvedDetailField[] {
  const overrides = schema.overrides ?? {};
  const excluded = new Set<string>([schema.titleKey, ...(schema.hiddenKeys ?? [])]);
  for (const [key, override] of Object.entries(overrides)) {
    if (override.hidden) excluded.add(key);
  }

  const candidateKeys = (
    options?.onlyKeys ?? Object.keys(properties)
  ).filter((key) => !excluded.has(key));

  const ordered = candidateKeys
    .map((key, index) => ({ key, order: overrides[key]?.order ?? index }))
    .sort((a, b) => a.order - b.order);

  const resolved: ResolvedDetailField[] = [];
  for (const { key } of ordered) {
    const override = overrides[key];
    const display = formatValue(properties[key], override?.format);
    if (display == null) continue;
    resolved.push({
      key,
      label: override?.label ?? autoLabel(key),
      display,
    });
  }
  return resolved;
}

/**
 * href가 빈 문자열이면 원본 속성이 비어있다는 뜻이다 — 깨진 링크(예: 값 없는
 * "tel:", 빈 href)를 만들지 않도록 걸러낸다. Popup/Sheet 둘 다 이 함수를 거쳐야
 * 한다 — href 계산 자체가 필드마다 다른 클로저라 정적으로 감지할 수 없다.
 */
export function resolveDetailLinks(
  properties: Record<string, unknown>,
  schema: DetailFieldsSchema,
): ResolvedDetailLink[] {
  if (!schema.links) return [];
  return schema.links
    .map((link) => ({ label: link.label, href: link.href(properties) }))
    .filter((link) => link.href);
}

/**
 * 데이터 레이어 상세 UI의 전체 필드 렌더러 — DetailSheet가 사용한다.
 * DetailPopup은 같은 resolve* 함수를 쓰되 일부 필드만 뽑아 좁은 폭에 맞춘 자체
 * 레이아웃으로 그린다.
 */
export function DetailFields({
  properties,
  schema,
}: {
  properties: Record<string, unknown>;
  schema: DetailFieldsSchema;
}) {
  const title = formatValue(properties[schema.titleKey]) ?? "";
  const fields = resolveDetailFields(properties, schema);
  const links = resolveDetailLinks(properties, schema);

  return (
    <div className="flex flex-col gap-3">
      <h3 className="font-heading text-base font-medium text-foreground">
        {title}
      </h3>
      <dl className="flex flex-col gap-1.5 text-sm">
        {fields.map((field) => (
          <div key={field.key} className="flex gap-2">
            <dt className="shrink-0 text-muted-foreground">{field.label}</dt>
            <dd className="text-foreground">{field.display}</dd>
          </div>
        ))}
      </dl>
      {links.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {links.map((link) => (
            <a
              key={link.label}
              href={link.href}
              target="_blank"
              rel="noreferrer"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              {link.label}
              <ExternalLink />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
