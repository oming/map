"use client";

import { ExternalLink } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface DetailFieldSchema {
  key: string;
  label: string;
  format?: (value: unknown) => string;
}

export interface DetailLinkSchema {
  label: string;
  href: (properties: Record<string, unknown>) => string;
}

export interface DetailFieldsSchema {
  titleKey: string;
  fields: DetailFieldSchema[];
  links?: DetailLinkSchema[];
}

function formatValue(
  value: unknown,
  format?: (value: unknown) => string,
): string | null {
  if (format) return format(value);
  if (value == null || value === "") return null;
  return String(value);
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

  return (
    <div className="flex flex-col gap-3">
      <h3 className="font-heading text-base font-medium text-foreground">
        {title}
      </h3>
      <dl className="flex flex-col gap-1.5 text-sm">
        {schema.fields.map((field) => {
          const display = formatValue(properties[field.key], field.format);
          if (display == null) return null;
          return (
            <div key={field.key} className="flex gap-2">
              <dt className="shrink-0 text-muted-foreground">
                {field.label}
              </dt>
              <dd className="text-foreground">{display}</dd>
            </div>
          );
        })}
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
    </div>
  );
}
