"use client";

import { useEffect, useState } from "react";
import { InfoIcon } from "lucide-react";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

// 공지 내용을 바꾸면 이 값을 올린다. "다시 보지 않기"를 누른 사용자에게도
// 새 버전이 자동으로 다시 노출된다.
const NOTICE_VERSION = "v1";
const NOTICE_DISMISSED_KEY = "map-qwer-notice-dismissed";

export function ServiceNotice() {
  const [open, setOpen] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(NOTICE_DISMISSED_KEY) !== NOTICE_VERSION) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOpen(true);
    }
  }, []);

  const handleOpenChange = (next: boolean) => {
    if (!next && dontShowAgain) {
      localStorage.setItem(NOTICE_DISMISSED_KEY, NOTICE_VERSION);
    }
    setOpen(next);
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent className="data-[size=default]:max-w-[calc(100vw-2rem)] data-[size=default]:sm:max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>map.qwer.dev 안내</AlertDialogTitle>
          <AlertDialogDescription>
            이 지도는 대한민국 브이월드(V-World) OpenAPI를 MapLibre GL JS로
            볼 수 있게 만든 서비스입니다. <br />
            브이월드는 대한민국 정부가 운영하는 공공 데이터이므로, 정부의
            정책이나 제도 변경에 따라 서비스 내용이 바뀌거나 일시 중단될 수
            있습니다.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex flex-col gap-3 text-sm">
          <p className="text-muted-foreground">
            과도한 자동화 요청, 무단 데이터 수집(스크래핑), 서비스 방해 등
            악의적인 방식의 이용은 금지되며, 확인될 경우 접근이 제한될 수
            있습니다.
          </p>
          <Alert>
            <InfoIcon />
            <AlertTitle>지도가 보이지 않나요?</AlertTitle>
            <AlertDescription>
              브라우저가 WebGL을 지원하지 않거나, WebGL이 비활성화되어 있을 수
              있습니다. <br />
              또는 VPN이나 프록시, 애플의 비공개 릴레이를 사용 중이라면, 해당
              서비스가 지도를 차단하고 있을 수 있습니다.
            </AlertDescription>
          </Alert>
        </div>
        <AlertDialogFooter className="items-center sm:justify-between">
          <Label className="flex items-center gap-2 text-sm font-normal">
            <Checkbox
              checked={dontShowAgain}
              onCheckedChange={setDontShowAgain}
            />
            다시 보지 않기
          </Label>
          <AlertDialogCancel>닫기</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
