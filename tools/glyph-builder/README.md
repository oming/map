# Glyph Builder — 폰트 빌더

MapLibre용 글리프(폰트) 파일을 생성하는 도구입니다.

## 개요

MapLibre GL JS에서 텍스트를 렌더링하기 위해 필요한 **글리프(Glyph)** 파일들을 생성합니다. 글리프는 각 문자의 기하학적 형태를 정의하는 벡터 데이터로, 폰트 패밀리별로 생성해야 합니다.

## 지원 폰트

| 폰트 패밀리 | 굵기 (Weight) | 파일명 패턴 |
|------------|--------------|-------------|
| NanumGothic | Regular (400) | `NanumGothic-400.pbf` |
| NanumGothic | Bold (700) | `NanumGothic-700.pbf` |
| NanumGothic | ExtraBold (800) | `NanumGothic-800.pbf` |

## 사용법

### 1. 폰트 소스 다운로드

**나눔고딕 폰트 파일** 다운로드:
- [Google Fonts - NanumGothic](https://fonts.google.com/noto/specimen/Noto+Sans+KR)
- 또는 [Korean Fonts GitHub](https://github.com/naver/tonen-gothic)

필요한 굵기:
- Regular (Light/Regular)
- Bold
- ExtraBold (Black/Bold)

### 2. MapLibre font-maker 웹사이트에서 변환

[MapLibre font-maker](https://maplibre.org/font-maker/) 웹사이트를 사용하여 나눔 폰트를 직접 변환합니다.

1. 웹사이트 접속: https://maplibre.org/font-maker/
2. **Download** 버튼으로 변환 도구 다운로드 (Node.js 필요)
3. 폰트 파일 선택: 로컬 `.otf` 또는 `.ttf` 파일 업로드
4. 범위 설정: `Range Start`와 `Range End` 입력 (한국어 문자 포함 시 `0-65535`)
5. **Generate** 버튼 클릭하여 `.pbf` 파일 생성/다운로드

각 굵기(Regular, Bold, ExtraBold)별로 반복:

```bash
# 생성된 .pbf 파일을 프로젝트 public/font/ 디렉토리로 복사
cp ./NanumGothic-*.pbf /Users/anhyosang/Developer/map.qwer.dev/public/font/
```

### 3. 출력 파일 이동

생성된 글리프 파일을 프로젝트의 public 디렉토리로 복사:

```bash
cp ./out/*.pbf /Users/anhyosang/Developer/map.qwer.dev/public/font/
```

## 출력 위치

```
/Users/anhyosang/Developer/map.qwer.dev/public/font/
├── NanumGothic-400.pbf      # Regular
├── NanumGothic-700.pbf      # Bold
└── NanumGothic-800.pbf      # ExtraBold
```

## 글리프 파일 구조

MapLibre 글리프 파일은 `{fontstack}/{range}.pbf` 형식으로 제공됩니다:

```
{fontstack}/
  {range_start}-{range_end}.pbf
```

예시:
```
NanumGothic/
  0-255.pbf      # ASCII ~ 기본 다국어
  256-511.pbf    # 확장 문자
  ...
```

## 스타일에서 참조 방법

`app/vworld.json/route.ts` 에서:

```javascript
const style = {
  glyphs: `${publicUrl}/font/{fontstack}/{range}.pbf`,
  // ...
};
```

- `{fontstack}`: 폰트 패밀리 이름 (예: `NanumGothic`)
- `{range}`: 글리프 범위 (예: `0-255`)

## 관련 도구

- [style-builder](../style-builder/) — POI 스타일 변환기 (폰트 매핑에 사용)
- [sprite-builder](../sprite-builder/) — 아이콘 스프라이트 생성

## 참고 사항

- **범위 설정**: `--range-start`와 `--range-end`는 포함할 문자 코드를 지정합니다. 대부분의 한국어 POI 데이터에는 기본 범위(0-255)만 필요할 수 있습니다.
- **폰트 굵기**: V-World 스타일에서 `lblThikAt === 'Y'`인 경우 Bold, 그렇지 않으면 Regular를 사용합니다. ExtraBold는 원본이 이미 최대 굵기라 항상 ExtraBold로 매핑됩니다.
- **파일 형식**: `.pbf` (Protocol Buffers) 형식으로, MapLibre에서 직접 로드할 수 있습니다.
