# 하이큐 배구 게임 엔진 v0.1.0 사용 설명서

이 문서는 AI(에이전트형/챗봇형 모두 포함)가 엔진을 정확하게 사용할 수 있도록
모호함 없이 작성한 기술 참조 문서입니다.

---

## 목차

1. [아키텍처 개요](#1-아키텍처-개요)
2. [HTML 설정](#2-html-설정)
3. [GameBuilder — 초기화](#3-gamebuilder--초기화)
4. [게임 로직 콜백 — initState / tick](#4-게임-로직-콜백--initstate--tick)
5. [EntityManager — 엔티티 등록](#5-entitymanager--엔티티-등록)
6. [Renderer — 렌더링 요구사항](#6-renderer--렌더링-요구사항)
7. [InputSystem — 입력](#7-inputsystem--입력)
8. [AssetStore — 에셋 로딩](#8-assetstore--에셋-로딩)
9. [Effector — 사운드 재생](#9-effector--사운드-재생)
10. [Physics — 물리 모듈](#10-physics--물리-모듈)
11. [Hitbox — 캐릭터 히트박스](#11-hitbox--캐릭터-히트박스)
12. [전체 사용 예시](#12-전체-사용-예시)
13. [v0.1.0 알려진 제한사항](#13-v010-알려진-제한사항)

---

## 1. 아키텍처 개요

### 레이어 구조

```
사용측 (game/)
  └─ main.js
       └─ GameBuilder  ─────────────────────── 엔진 조립 진입점
            ├─ Renderer      (er)  출력/소비, 틱 종속
            ├─ Effector      (er)  출력/소비, 틱 비종속
            ├─ InputSystem   (System) 입력 스트림, 틱 종속
            └─ Game
                 ├─ StateSystem  (System) 상태 컨테이너, 게임 로직 위임
                 └─ EntityManager (Manager) 엔티티 등록/삭제, 틱 비종속
```

### 레이어 명명 규칙

| 접미사 | 역할 | 틱 종속 여부 |
|--------|------|-------------|
| `er` (Renderer, Effector) | 출력/소비 담당 | Renderer는 종속, Effector는 비종속 |
| `System` (InputSystem, StateSystem) | 입력 스트림/상태 관리 | 종속 |
| `Manager` (EntityManager) | 동적 등록/삭제 | 비종속 |
| `Store` (AssetStore) | 읽기 전용 데이터 | 비종속 |
| `Builder` (GameBuilder) | 초기화/조립 | 비종속 |

### 틱(tick)당 데이터 흐름

```
RAF 루프
  │
  ├─ [매 틱] InputSystem.next()      → inputs 스냅샷 획득
  │             │
  │         StateSystem.tick(inputs)  → 게임 로직 tick 콜백 실행
  │             │
  │         Effector.play(toPlay)     → 사운드 재생
  │
  └─ [매 프레임] Renderer.draw(buf, entityManager) → 화면 그리기
```

RAF(requestAnimationFrame)는 매 프레임 실행되지만, **tick은 1000/60ms(약 16.7ms)마다 한 번만 실행**됩니다.
Renderer는 매 프레임 최신 상태(buf)를 그립니다.

---

## 2. HTML 설정

```html
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="global.css">
  <title>게임 제목</title>
</head>
<body>
  <!-- Renderer가 이 canvas를 사용한다. id는 반드시 gameCanvas 또는 직접 참조. -->
  <canvas id="gameCanvas"></canvas>
  <script type="module" src="main.js"></script>
</body>
</html>
```

`<script type="module">`이 필수입니다. 엔진은 ES Module 시스템을 사용합니다.

---

## 3. GameBuilder — 초기화

### 임포트

```js
import { GameBuilder } from './engine/GameBuilder.js';
```

### API

```js
const game = await new GameBuilder(canvas)
  .setAssets(assetDescription)      // 선택. 에셋 없으면 생략 가능.
  .setKeyboardMapping(keyboardMap)  // 선택. 입력 없으면 생략 가능.
  .setTouchMapping(touchMap)        // 선택. v0.1.0에서 미구현.
  .build();                         // 비동기. 에셋 로딩 완료 후 Game 반환.

game.start(match, logic);           // 게임 루프 시작.
game.init().start(newMatch, logic); // 루프 재시작 (init()은 루프를 멈추고 자신을 반환).
```

### 파라미터 상세

**`canvas`** `HTMLCanvasElement`
- `document.getElementById('gameCanvas')` 등으로 획득한 canvas 요소.
- Renderer가 이 canvas에 그린다. 크기는 Renderer가 논리 해상도(800×450)로 고정하고 CSS로 스케일한다.

**`assetDescription`** `{ [name: string]: url: string }`
- 로딩할 에셋의 이름-URL 매핑. 파일명 규칙으로 타입 자동 판별 ([8. AssetStore](#8-assetstore--에셋-로딩) 참조).

**`keyboardMapping`** `{ [InputTypeName: string]: KeyboardEventCode: string }`
- 입력 이름 → 키보드 코드 매핑. 형식 주의: **InputTypeName이 키, KeyboardCode가 값**이다.
  (`InputSystem` 내부에서 swapKeyVal로 반전하여 사용한다.)

```js
// 올바른 형식
const keyboardMap = {
  '1P_LEFT':  'ArrowLeft',
  '1P_RIGHT': 'ArrowRight',
  '1P_UP':    'ArrowUp',
  '1P_DOWN':  'ArrowDown',
  '1P_ACTION':'ShiftRight',
  '2P_LEFT':  'KeyA',
  '2P_RIGHT': 'KeyD',
  '2P_UP':    'KeyW',
  '2P_DOWN':  'KeyS',
  '2P_ACTION':'ShiftLeft',
};
```

KeyboardEventCode 값은 `KeyboardEvent.code` 기준이다 (`'ArrowLeft'`, `'KeyA'` 등).
유효한 InputTypeName 목록은 [7. InputSystem](#7-inputsystem--입력)을 참조하라.

**`match`** `any`
- `initState(match, entityManager)` 콜백에 그대로 전달되는 값. 엔진은 내용을 검사하지 않는다.
- 매치 설정(참여 플레이어 수, 난이도 등)을 담기 위해 사용한다.

**`logic`** `{ initState: Function, tick: Function }`
- 게임 로직 콜백 묶음. [4. 게임 로직 콜백](#4-게임-로직-콜백--initstate--tick) 참조.

---

## 4. 게임 로직 콜백 — initState / tick

`game.start(match, logic)`에 전달하는 `logic` 객체는 두 개의 콜백을 가진다.

### initState

```js
function initState(match, entityManager) {
  // 1. entityManager에 엔티티를 등록한다.
  // 2. 초기 게임 상태 객체를 반환한다.
  return initialState; // 반환값이 최초 state가 된다.
}
```

**호출 시점**: `GameBuilder.build()` 후 `game.start()` 시 한 번만 호출된다.
**반환값**: 이후 `tick(state, inputs)`의 `state`로 사용되는 초기 상태 객체.
**반환값 구조 요구사항**: [6. Renderer](#6-renderer--렌더링-요구사항) 참조.

### tick

```js
function tick(state, inputs) {
  // 1. inputs를 읽어 상태를 갱신한다.
  // 2. 물리 계산, 충돌 처리 등을 수행한다.
  // 3. 재생할 사운드 에셋 ID 배열과 새 상태를 반환한다.
  return {
    nextState: newState, // 다음 틱의 state가 된다.
    toPlay: ['hit_sound'], // 재생할 사운드 에셋 이름 배열. 없으면 [].
  };
}
```

**호출 시점**: 매 틱(약 16.7ms)마다 `StateSystem.tick(inputs)` 내부에서 호출된다.
**반환값 필수 필드**:
- `nextState`: 다음 틱 상태. 누락 시 다음 틱 state가 undefined가 된다.
- `toPlay`: 사운드 에셋 이름 문자열 배열. 재생할 것이 없으면 반드시 `[]`를 반환한다.

---

## 5. EntityManager — 엔티티 등록

### 임포트 불필요

EntityManager는 `initState(match, entityManager)`의 두 번째 인자로 주어진다. 직접 생성하지 않는다.

### API

```js
entityManager.register(id, entity)   // 등록. 체이닝 가능.
entityManager.unregister(id)          // 삭제. 체이닝 가능.
entityManager.get(id)                 // 단일 엔티티 반환. 없으면 undefined.
entityManager.getAll()                // 모든 엔티티의 iterator 반환.
entityManager.has(id)                 // 등록 여부 boolean 반환.
```

### 엔티티 스키마

`register(id, entity)` 호출 시 `entity` 객체는 다음 형태 중 하나를 따른다.
등록된 엔티티는 `Object.freeze`로 동결된다(수정 불가).

```js
// 에셋 없는 엔티티 (렌더링 불가, 로직용)
{ type: 'entity' }

// 단일 이미지 엔티티
{
  type: 'entity',  // 또는 'bg', 'ui'
  assetId: 'background',  // AssetStore의 에셋 이름
  flipH: false,           // 선택. 수평 반전 여부.
  flipV: false,           // 선택. 수직 반전 여부.
}

// 스프라이트 시트 엔티티
{
  type: 'entity',
  assetId: 'player_sprite',
  spriteIndex: 0,   // 스프라이트 시트의 프레임 인덱스. 고정값 (v0.1.0 제한사항).
  flipH: false,
  flipV: false,
}
```

**`type` 필드**는 렌더링 레이어를 결정한다:
- `'bg'`: 배경 레이어 (맨 아래)
- `'ui'`: UI 레이어 (맨 위)
- 그 외 모든 값: 엔티티 레이어 (중간)

**`id`** `string`: 엔티티 고유 식별자. 상태 객체의 키와 동일해야 렌더링된다.

**`spriteIndex`** `number`: 등록 시 고정되며 이후 변경 불가. v0.1.0에서 per-tick 애니메이션 미지원.

### 주의사항

- `unregister` 후 동일 id로 재등록 가능하다.
- `initState` 이외의 시점에도 `unregister`/`register` 호출 가능하다(동적 스포닝에 활용).
- EntityManager는 상태(위치, 속도 등)를 저장하지 않는다. 상태는 모두 StateSystem의 state 객체에 저장한다.

---

## 6. Renderer — 렌더링 요구사항

### 좌표계

```
(0, 0) ──────────── (800, 0)
   │                    │
   │   논리 해상도       │   Y축 아래 증가 (Canvas 표준)
   │   800 × 450        │
   │                    │
(0, 450) ─────── (800, 450)
```

- 논리 해상도: **800 × 450** (고정, 변경 불가).
- 화면 크기에 따라 CSS로 letterbox 스케일링된다.
- **주의**: Physics 모듈의 좌표계와 다르다. Physics는 좌하단 원점, Y축 위 증가를 사용한다.

### state 구조 요구사항

`tick`이 반환하는 `nextState`는 Renderer가 `buf[entity.id]`로 접근한다.
렌더링되어야 하는 **모든 엔티티의 id를 키로**, 아래 필드를 포함하는 객체를 값으로 가져야 한다.

```js
{
  // 렌더링 필수 필드
  [entity.id]: {
    x: number,  // 스프라이트 좌상단 X (Canvas 픽셀)
    y: number,  // 스프라이트 좌상단 Y (Canvas 픽셀)
    w: number,  // 스프라이트 너비 (Canvas 픽셀)
    h: number,  // 스프라이트 높이 (Canvas 픽셀)
  },

  // 게임 로직 전용 상태는 아무 키나 사용 가능 (Renderer가 무시함)
  score: { p1: 0, p2: 0 },
  phase: 'rally',
  // ... 등
}
```

**`x`, `y`는 스프라이트 좌상단 기준**이다. Renderer는 `(x + w/2, y + h/2)`를 중심으로 그린다.
`assetId`가 없는 엔티티는 상태가 없어도 무시된다.
`assetId`가 있으나 해당 id의 상태가 state에 없으면(`!state`) 해당 엔티티는 그리지 않는다.

### 렌더링 레이어 순서

1. `type: 'bg'` 엔티티 (배경)
2. `type`이 `'bg'`, `'ui'` 아닌 엔티티 (게임 오브젝트)
3. `type: 'ui'` 엔티티 (HUD, 점수판 등)

---

## 7. InputSystem — 입력

### 임포트

```js
import { InputType } from './engine/InputSystem.js';
```

`InputSystem` 자체는 `GameBuilder` 내부에서 초기화되므로 직접 임포트하지 않는다.
`InputType`만 임포트하여 `tick` 콜백에서 inputs 접근 시 사용한다.

### InputType 목록

```
1P_UP      1P_DOWN      1P_LEFT      1P_RIGHT      1P_ACTION
2P_UP      2P_DOWN      2P_LEFT      2P_RIGHT      2P_ACTION

1P_DOUBLE_UP    1P_DOUBLE_DOWN    1P_DOUBLE_LEFT    1P_DOUBLE_RIGHT
2P_DOUBLE_UP    2P_DOUBLE_DOWN    2P_DOUBLE_LEFT    2P_DOUBLE_RIGHT
```

`InputType`은 `{ '1P_UP': '1P_UP', '1P_DOWN': '1P_DOWN', ... }` 형태의 frozen 객체다.
값과 키가 동일한 string enum이다.

### inputs 스냅샷 구조

`tick(state, inputs)`의 `inputs`는 다음 구조를 가진다:

```js
{
  '1P_UP':    boolean,  // 현재 틱에 눌려 있으면 true
  '1P_DOWN':  boolean,
  // ... 모든 InputType 키 포함
  '1P_DOUBLE_LEFT': boolean,  // 더블탭 감지 시 해당 틱만 true, 다음 틱 false
  // ...
}
```

**접근 방법**:

```js
function tick(state, inputs) {
  const jumpPressed   = inputs[InputType['1P_UP']];    // 현재 UP 키 눌림
  const diveTriggered = inputs[InputType['1P_DOUBLE_LEFT']]; // 이 틱에 더블탭 발생
}
```

### 더블탭 감지 규칙

- 같은 방향키를 **500ms 이내에 두 번 누를 때** `DOUBLE_*` 입력이 `true`가 된다.
- `DOUBLE_*` 입력은 감지된 **틱 하나만 `true`**이며 다음 틱에 자동으로 `false`로 초기화된다.
- `ACTION` 키에는 더블탭 감지가 없다.

### 기본 Keyboard.json 매핑

```json
{
  "1P_UP":    "ArrowUp",
  "1P_DOWN":  "ArrowDown",
  "1P_LEFT":  "ArrowLeft",
  "1P_RIGHT": "ArrowRight",
  "2P_UP":    "KeyW",
  "2P_DOWN":  "KeyS",
  "2P_LEFT":  "KeyA",
  "2P_RIGHT": "KeyD"
}
```

이 파일은 참고용이다. `GameBuilder.setKeyboardMapping()`에 직접 객체로 전달한다.

---

## 8. AssetStore — 에셋 로딩

### 파일명 규칙

에셋 URL의 **파일명 부분**으로 타입을 판별한다. 경로는 무관하다.

| 파일명 패턴 | 결과 타입 | 비고 |
|-------------|-----------|------|
| `name.img.png` | `ImageBitmap` | 단일 이미지 |
| `name.img32.png` | `SpriteFrame[]` | 32px 정사각형 격자로 분할 |
| `name.imgN.png` | `SpriteFrame[]` | N px 정사각형 격자로 분할 |
| `name.sound.mp3` | `AudioBuffer` | 사운드 (확장자 무관) |

**SpriteFrame** 구조:
```js
{ image: ImageBitmap, sx: number, sy: number, sw: number, sh: number }
```
왼쪽 위에서 오른쪽으로, 위에서 아래로 인덱싱된다.

### assetDescription 형식

```js
const assetDescription = {
  'player':     '/asset/character/player.img32.png',
  'background': '/asset/bg/court.img.png',
  'hit_sound':  '/asset/sound/hit.sound.mp3',
};
```

**키(이름)는 에셋 참조 ID**이며, `EntityManager.register`의 `assetId` 및 `toPlay` 배열에서 사용된다.

---

## 9. Effector — 사운드 재생

### 사용 방법

직접 호출할 필요 없다. `tick` 콜백의 반환값 `toPlay` 배열에 에셋 이름을 넣으면 Game 루프가 자동으로 `Effector.play(toPlay)`를 호출한다.

```js
function tick(state, inputs) {
  const toPlay = [];
  if (ballHitPlayer) toPlay.push('hit_sound');
  return { nextState, toPlay };
}
```

**AudioContext 정책**: Effector는 첫 사용자 제스처 후 `game.start()`에서 자동 초기화된다.
페이지 로드 직후 사운드를 재생하면 브라우저가 차단할 수 있으니, `game.start()`는 반드시 사용자 이벤트(클릭, 키 입력 등) 핸들러 안에서 호출한다.

---

## 10. Physics — 물리 모듈

### 임포트

```js
import {
  PhysicsMap,
  applyGravity,
  resolveBody,
  detectBodies,
  detectBallVsCompound,
  detectVsMap,
  resolveCollision,
} from './engine/Physics.js';
```

Physics 모듈은 **순수 함수 모음**이다. 인스턴스 상태가 없다. 게임 로직 `tick()` 안에서 직접 호출한다.

### 좌표계 (Renderer와 다름)

```
(0, h) ──────── (w, h)   ← 맵 상단
   │                 │
   │   물리 좌표계   │   Y축 위 증가
   │                 │
(0, 0) ──────── (w, 0)   ← 원점 (맵 좌하단)
```

- 단위: **캔버스 가로 = 1**. 예) 800px 캔버스에서 1 unit = 800px.
- Renderer에 전달하는 `x, y`(픽셀)와 물리 좌표(unit)는 별도로 관리하거나 변환해야 한다.

**좌표 변환 (물리 unit → Canvas px)**:
```js
const PX = LOGICAL_WIDTH; // = 800
const canvas_x =  phys_x * PX;
const canvas_y = LOGICAL_HEIGHT - phys_y * PX;
```

### 엔티티 원점 규칙

| 엔티티 | 원점 위치 |
|--------|-----------|
| 공 | 중심점 |
| 플레이어 | 밑바닥 중앙 |
| 네트 | 밑바닥 중앙 |

모든 바디의 `ox, oy`는 **엔티티 원점 기준 오프셋**이다.

### PhysicsMap

```js
const map = new PhysicsMap(w, h);
// w: 맵 너비 (unit). 캔버스와 같은 크기면 1.
// h: 맵 높이 (unit). 캔버스 높이를 넘을 수 있음.
// 예: 800×600 캔버스에서 캔버스 크기 맵 → new PhysicsMap(1, 0.75)
```

맵 경계가 물리 경계다. 경계 바디는 별도로 없다.

### 바디 정의 스키마

```js
// 원 (circle)
{
  shape: 'circle',
  ox: number,         // 엔티티 원점 기준 X 오프셋 (unit)
  oy: number,         // 엔티티 원점 기준 Y 오프셋 (unit)
  r: number,          // 반지름 (unit)
  restitution: number // 탄성계수. 0 = 비탄성, 0~1 = 탄성.
}

// 캡슐 (capsule) = 선분 + 반지름
{
  shape: 'capsule',
  ox: number,     // 캡슐 중심 X 오프셋 (unit)
  oy: number,     // 캡슐 중심 Y 오프셋 (unit)
  length: number, // 선분 전체 길이 (unit). 양 끝 원 중심 간 거리.
  angle: number,  // 선분 방향 (라디안). 0 = 오른쪽 수평, Math.PI/2 = 위 수직.
  r: number,      // 캡슐 반지름 (unit)
  restitution: number
}
```

### resolveBody — 월드 좌표 변환

바디의 `ox, oy`를 엔티티 전역 위치에 더해 `wx, wy`(월드 좌표)를 추가한 새 객체를 반환한다.
충돌 감지 함수에 전달하기 전에 반드시 호출해야 한다.

```js
const resolvedBall = resolveBody(state.ball.x, state.ball.y, state.ball.body);
// resolvedBall = { ...state.ball.body, wx: ..., wy: ... }
```

### detectBodies — 두 바디 간 충돌 감지

```js
const hit = detectBodies(resolvedA, resolvedB);
// hit: { nx, ny, depth } | null
// nx, ny: 충돌 법선 벡터 (A → B 방향, 단위 벡터)
// depth: 겹침 깊이 (unit)
```

지원 조합: `circle-circle`, `circle-capsule`, `capsule-circle`.
`capsule-capsule`은 v0.1.0에서 미지원.

### detectBallVsCompound — 복합 바디 충돌

```js
const bodies = Object.values(state.p1.bodies).map(b =>
  resolveBody(state.p1.x, state.p1.y, b)
);
const ballResolved = resolveBody(state.ball.x, state.ball.y, state.ball.body);

const hit = detectBallVsCompound(ballResolved, bodies);
// 가장 깊이 겹친 바디 기준으로 { nx, ny, depth } | null 반환
```

`ball`은 반드시 `shape: 'circle'`인 resolved 바디여야 한다.

### detectVsMap — 맵 경계 충돌

```js
const hits = detectVsMap(resolvedBody, map);
// hits: Array<{ nx, ny, depth, side }>
// side: 'bottom' | 'top' | 'left' | 'right'
// 경계에 닿지 않으면 빈 배열 []
```

한 바디가 여러 경계에 동시에 닿으면 여러 항목이 반환된다.

### resolveCollision — 충돌 해소

```js
const { newVelA, newVelB } = resolveCollision(
  { x: state.ball.vx, y: state.ball.vy }, // velA
  state.ball.body.restitution,             // rA
  { x: state.p1.vx, y: state.p1.vy },     // velB (비탄성이면 변경 안 됨)
  0,                                        // rB (플레이어는 비탄성)
  hit                                       // { nx, ny }
);
state.ball.vx = newVelA.x;
state.ball.vy = newVelA.y;
// state.p1 속도는 변경하지 않음 (rB=0이므로 newVelB = velB 그대로)
```

**탄성 조합 규칙**:

| rA | rB | 결과 |
|----|-----|------|
| >0 | >0 | 둘 다 반사. 반발계수 = min(rA, rB). |
| >0 | 0  | A만 반사. B 속도를 반사 계산 입력으로만 사용. B 속도 불변. |
| 0  | >0 | B만 반사. A 속도를 반사 계산 입력으로만 사용. A 속도 불변. |
| 0  | 0  | 둘 다 법선 방향 속도 → 0. (막힘) |

**맵 경계 충돌 시**: `velB = { x:0, y:0 }`, `rB = 0`으로 호출한다.

```js
for (const hit of detectVsMap(resolvedBall, map)) {
  const { newVelA } = resolveCollision(
    { x: state.ball.vx, y: state.ball.vy },
    state.ball.body.restitution, // 공: 0.9
    { x: 0, y: 0 }, 0,           // 맵 경계: 정적 비탄성
    hit
  );
  state.ball.vx = newVelA.x;
  state.ball.vy = newVelA.y;
  // 위치 보정 (겹침 제거)
  state.ball.x += hit.nx * hit.depth;
  state.ball.y += hit.ny * hit.depth;
}
```

**중요**: `resolveCollision`은 속도만 반환한다. **위치 보정(`entity.x += nx * depth`)은 호출측이 직접 수행**해야 한다.

**이미 분리 중인 경우**: 두 바디가 이미 멀어지는 방향이면 (`relVn >= 0`) 속도를 변경하지 않고 그대로 반환한다.

### applyGravity

```js
state.ball.vy = applyGravity(state.ball.vy, BALL_GRAVITY);
// Physics 좌표계에서 Y축이 위 방향이므로 vy를 감소시킨다.
// BALL_GRAVITY는 매 틱 감소량 (unit/tick). 예: 0.0003
```

---

## 11. Hitbox — 캐릭터 히트박스

### 임포트

```js
import { initPlayerBodies, updatePlayerBodies } from './game/Hitbox.js';
```

### 용도

플레이어 엔티티의 물리 바디(bodies) 초기화 및 액션별 자세 갱신.

### initPlayerBodies

```js
// initState에서 플레이어 상태 초기화 시 호출
const player = {
  x: 0.2, y: 0,  // 물리 좌표
  vx: 0, vy: 0,
  facing: 1,     // 1 = 오른쪽, -1 = 왼쪽
  action: { type: 'IDLE', tick: 0, duration: 0 },
  bodies: initPlayerBodies(), // head + torso 초기화
};
```

반환값:
```js
{
  head:  { shape: 'circle',  ox: 0, oy: -0.070, r: 0.0175, restitution: 0 },
  torso: { shape: 'capsule', ox: 0, oy: -0.040, length: 0.050, angle: Math.PI/2, r: 0.020, restitution: 0 },
}
```

### updatePlayerBodies

```js
// tick()에서 매 틱 호출
updatePlayerBodies(player);
// player.bodies를 현재 action.type과 action.tick에 따라 갱신한다.
```

**액션별 bodies 변화**:

| action.type | bodies 변화 |
|-------------|-------------|
| IDLE / RUN / JUMP | head + torso (기본). arm 없음. |
| SPIKE / SKILL | head + torso + arm. arm 각도가 action.tick에 따라 스윙. |
| BLOCK | head + torso + arm (머리 위 수평). |
| DIVE | head + torso(수평으로 변형). arm 없음. |
| RECEIVE | head + torso + arm (언더핸드 각도). |

**주의**: `updatePlayerBodies`는 `player.bodies`를 직접 변경(mutation)한다. 반환값 없다.
매 틱 반드시 호출해야 SPIKE 스윙 등 자세 보간이 정상 동작한다.

---

## 12. 전체 사용 예시

```js
// main.js
import { GameBuilder } from './engine/GameBuilder.js';
import { InputType }   from './engine/InputSystem.js';
import {
  PhysicsMap, applyGravity, resolveBody,
  detectBallVsCompound, detectVsMap, resolveCollision,
} from './engine/Physics.js';
import { initPlayerBodies, updatePlayerBodies } from './game/Hitbox.js';

// ─── 상수 ──────────────────────────────────────────────────────────────
const MAP_W = 1, MAP_H = 0.5625; // 800×450 캔버스에서 캔버스 크기 맵
const map = new PhysicsMap(MAP_W, MAP_H);
const PX = 800; // 1 unit = 800px

const BALL_G   = 0.0003;
const PLAYER_G = 0.0005;
const BALL_R   = 0.0225; // 18px

// ─── 게임 로직 콜백 ────────────────────────────────────────────────────
function initState(match, entityManager) {
  entityManager
    .register('ball',    { type: 'entity', assetId: 'ball_img' })
    .register('player1', { type: 'entity', assetId: 'player_sprite', spriteIndex: 0 });

  const player1 = {
    x: 0.2, y: 0,
    vx: 0, vy: 0,
    facing: 1,
    action: { type: 'IDLE', tick: 0, duration: 0 },
    bodies: initPlayerBodies(),
  };

  const ball = {
    x: 0.5, y: 0.3,
    vx: 0.002, vy: 0,
    body: { shape: 'circle', ox: 0, oy: 0, r: BALL_R, restitution: 0.9 },
  };

  // Renderer가 읽는 렌더링 상태 (픽셀 단위)
  return {
    player1,
    ball,
    // Renderer 접근용: buf['player1'], buf['ball']
    'player1': { x: player1.x * PX - 24, y: 450 - player1.y * PX - 64, w: 48, h: 64 },
    'ball':    { x: ball.x * PX - BALL_R * PX, y: 450 - (ball.y + BALL_R) * PX, w: BALL_R * PX * 2, h: BALL_R * PX * 2 },
  };
}

function tick(state, inputs) {
  const toPlay = [];

  // 중력
  state.ball.vy = applyGravity(state.ball.vy, BALL_G);

  // 이동
  state.ball.x += state.ball.vx;
  state.ball.y += state.ball.vy;

  // 공 vs 맵 경계
  const ballResolved = resolveBody(state.ball.x, state.ball.y, state.ball.body);
  for (const hit of detectVsMap(ballResolved, map)) {
    const { newVelA } = resolveCollision(
      { x: state.ball.vx, y: state.ball.vy }, state.ball.body.restitution,
      { x: 0, y: 0 }, 0,
      hit
    );
    state.ball.vx = newVelA.x;
    state.ball.vy = newVelA.y;
    state.ball.x += hit.nx * hit.depth;
    state.ball.y += hit.ny * hit.depth;
    if (hit.side === 'bottom') toPlay.push('bounce_sound');
  }

  // 공 vs 플레이어 복합 바디
  updatePlayerBodies(state.player1);
  const p1Bodies = Object.values(state.player1.bodies).map(b =>
    resolveBody(state.player1.x, state.player1.y, b)
  );
  const ballResolvedFresh = resolveBody(state.ball.x, state.ball.y, state.ball.body);
  const hit = detectBallVsCompound(ballResolvedFresh, p1Bodies);
  if (hit) {
    const { newVelA } = resolveCollision(
      { x: state.ball.vx, y: state.ball.vy }, state.ball.body.restitution,
      { x: state.player1.vx, y: state.player1.vy }, 0,
      hit
    );
    state.ball.vx = newVelA.x;
    state.ball.vy = newVelA.y;
    state.ball.x += hit.nx * hit.depth;
    state.ball.y += hit.ny * hit.depth;
    toPlay.push('hit_sound');
  }

  // Renderer 상태 갱신 (물리 unit → Canvas px)
  state['ball'] = {
    x: state.ball.x * PX - BALL_R * PX,
    y: 450 - (state.ball.y + BALL_R) * PX,
    w: BALL_R * PX * 2,
    h: BALL_R * PX * 2,
  };

  return { nextState: state, toPlay };
}

// ─── 엔진 시작 ─────────────────────────────────────────────────────────
const canvas = document.getElementById('gameCanvas');
const game = await new GameBuilder(canvas)
  .setAssets({
    'ball_img':     '/asset/ball.img.png',
    'player_sprite':'/asset/player.img32.png',
    'hit_sound':    '/asset/hit.sound.mp3',
    'bounce_sound': '/asset/bounce.sound.mp3',
  })
  .setKeyboardMapping({
    '1P_LEFT':  'ArrowLeft',
    '1P_RIGHT': 'ArrowRight',
    '1P_UP':    'ArrowUp',
    '1P_DOWN':  'ArrowDown',
    '1P_ACTION':'ShiftRight',
  })
  .build();

// game.start()는 반드시 사용자 제스처 이후에 호출한다 (AudioContext 정책).
document.addEventListener('keydown', () => {
  game.start({ players: 1 }, { initState, tick });
}, { once: true });
```

---

## 13. v0.1.0 알려진 제한사항

| 항목 | 내용 |
|------|------|
| **스프라이트 애니메이션** | `EntityManager`의 `spriteIndex`는 등록 시 고정. per-tick 프레임 변경 불가. |
| **터치 입력** | `setTouchMapping()` API는 존재하나 내부 구현이 없음(`TODO`). 동작하지 않는다. |
| **캡슐-캡슐 충돌** | `detectBodies`에서 지원하지 않음. `null` 반환. |
| **물리-렌더 좌표 통합** | Physics(좌하단 원점, Y↑)와 Renderer(좌상단 원점, Y↓)가 별개. 변환 코드를 직접 작성해야 한다. |
| **AI 상대** | 미구현. |
| **다중 캐릭터** | 캐릭터 스탯/스킬 시스템 미구현. |
