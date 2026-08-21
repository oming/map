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
  href: (properties: Record<string, unknown>) => string;
}

export interface DetailListSchema {
  /** properties[key]가 배열일 때만 렌더링한다. */
  key: string;
  itemLabel: (item: unknown) => string;
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
  /** 같은 좌표에 여러 시설이 묶인 경우(예: 건물 단위 좌표만 있는 화장실) 목록으로 나열한다. */
  list?: DetailListSchema;
  /** 팝업(마커 클릭 시 첫 화면)에 보여줄 속성 키. 생략하면 자동 노출 대상 중 앞에서부터
   *  몇 개를 기본값으로 쓴다(POPUP_FIELD_LIMIT, detail-popup.tsx). */
  popupFields?: string[];
}

export interface ResolvedDetailField {
  key: string;
  label: string;
  display: string;
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
  if (schema.list) excluded.add(schema.list.key);
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
 * 데이터 레이어 상세 UI의 기본 렌더러. 대부분의 데이터셋(Wi-Fi, 화장실 등)은
 * 이 컴포넌트만으로 충분하고, 특수한 레이아웃이 필요한 경우에만
 * DataLayerDef.detail.custom(lazy 컴포넌트)으로 대체한다.
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
      {schema.links && schema.links.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {schema.links.map((link) => (
            <a
              key={link.label}
              href={link.href(properties)}
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
      {schema.list &&
        Array.isArray(properties[schema.list.key]) &&
        (properties[schema.list.key] as unknown[]).length > 0 && (
          <ul className="flex max-h-72 flex-col divide-y divide-border overflow-y-auto rounded-md border text-sm">
            {(properties[schema.list.key] as unknown[]).map((item, index) => (
              <li key={index} className="px-3 py-2">
                {schema.list!.itemLabel(item)}
              </li>
            ))}
          </ul>
        )}
    </div>
  );
}
