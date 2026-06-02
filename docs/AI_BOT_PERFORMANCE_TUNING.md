# AI Bot Performance Tuning Report

## 1. 개선 목적

기존 `BotController`는 최신 `GameLoop` 입력 흐름에는 연결되어 있었지만, 실제 판단은 현재 공 위치 중심의 단순 규칙에 가까웠다. 그 결과 다음 문제가 있었다.

- 공의 낙하지점을 충분히 예측하지 못해 늦게 이동함
- 낮은 공, 먼 공, 네트 근처 공에서 `RECEIVE` / `DIVE` / `BLOCK` / `SPIKE` 선택이 일관되지 않음
- 공격·블로킹 타이밍이 현재 위치 기준이라 너무 빠르거나 늦음
- 공이 상대 코트에 있을 때 수비 홈 위치로 돌아가지 못하고 멈추거나 과도하게 따라감
- cooldown이 남아 있는 짧은 구간에 중요한 액션을 놓침
- 공격형/수비형/랠리형 차이가 랜덤 선택 이름에 가깝고 실제 판단 차이가 작음

이번 작업의 목표는 엔진 구조를 바꾸지 않고, AI가 기존처럼 `2P_*` 입력 스냅샷만 생성하면서 더 빠르게 예측하고 조건 기반으로 자연스럽게 플레이하도록 만드는 것이다.

## 2. 변경된 AI 구조

### 주요 파일

- `src/game/ai/BotController.js`
  - AI profile, 튜닝 상수, 공 궤적 예측, 위치 선정, 액션 판단, cooldown, debug info를 관리한다.
- `test/ai-bot-smoke.mjs`
  - 대표 상황별 입력 생성과 `GameLoop + BotController` 180tick 실행을 검증한다.

### BotController가 반환하는 입력 키

AI는 state를 직접 수정하지 않고 다음 입력 키만 boolean으로 반환한다.

- 이동/기본 액션: `2P_LEFT`, `2P_RIGHT`, `2P_UP`, `2P_DOWN`, `2P_ACTION`
- 더블탭 액션: `2P_DOUBLE_UP`, `2P_DOUBLE_DOWN`, `2P_DOUBLE_LEFT`, `2P_DOUBLE_RIGHT`

`playerSide: 'left'`로 생성하면 같은 구조에서 `1P_*` 키를 반환할 수 있다.

### state 좌표·속도 구조

`GameLoop`와 `GameLogic` 기준 상태 구조는 다음과 같다.

- `state.player2`
  - `x`, `y`: 물리 좌표. 플레이어 원점은 발밑 중앙이다.
  - `vx`, `vy`: tick당 속도.
  - `facing`: `1`은 오른쪽, `-1`은 왼쪽.
  - `onGround`: 지면 접촉 여부.
  - `actionType`, `actionTick`, `actionDuration`: 현재 액션 상태.
- `state.ball`
  - `x`, `y`: 공 중심 좌표.
  - `vx`, `vy`: tick당 속도.
  - `actionRangeCooldown`: 스파이크/리시브 액션 범위 중복 판정 제한.
- `state.net`
  - `x`, `y`, `vx`, `vy`: 네트 위치와 속도. 보통 `x = 0.5`, `y = 0`이다.

물리 단위는 기존 게임과 동일하게 `1 unit = 800px` 기준이다. Y축은 위쪽이 양수이며 중력은 매 tick `vy`를 감소시킨다.

## 3. 공 예측 로직

### 주요 함수

- `simulateBallTrajectory(ball, options)`
  - 현재 공의 `x`, `y`, `vx`, `vy`를 복사해 미래 tick을 시뮬레이션한다.
  - `ballGravity`를 반영한다.
  - 좌우 벽 반사를 반영한다.
  - 간단한 네트 반사를 반영한다.
  - 원본 `state.ball`은 수정하지 않는다.
- `predictBallLanding(state, botSide, options)`
  - 시뮬레이션 결과에서 바닥 도달 지점과 자기 코트 진입 후 낮아지는 지점을 찾는다.
  - `landingX`, `landingTick`, `intercept`, `willEnterMyCourt`를 반환한다.
- `clampToCourt(x, side, context)`
  - AI가 네트, 벽, 코트 경계에 과도하게 붙지 않도록 이동 목표를 제한한다.

### 예상 낙하지점 계산 방식

1. 최대 예측 tick(`maxPredictionTicks`, 기본 96)까지 공을 시뮬레이션한다.
2. 공이 자기 코트에 들어오고 낮아지기 시작한 지점을 우선 intercept 후보로 잡는다.
3. 바닥에 닿는 지점이 있으면 낙하지점으로 사용한다.
4. 결과 X는 자기 코트 범위로 clamp한다.
5. 플레이어 이동 속도와 반응 지연 tick을 고려해 실제로 도달 가능한 intercept를 찾는다.

### 한계점

- 실제 플레이어 히트박스 충돌까지 완전 예측하지는 않는다.
- 네트 충돌 예측은 캡슐 충돌의 정밀 모델이 아니라 위치 기반 단순 반사다.
- 상대 플레이어가 공을 칠 경우 궤적이 바뀌므로 매 tick 재예측하는 방식으로 보정한다.

## 4. 행동 판단 로직

액션 우선순위는 다음 순서로 정리했다.

1. 낮고 가까운 자기 코트 공 → `RECEIVE`
2. 낮고 멀지만 곧 떨어지는 자기 코트 공 → `DIVE`
3. 네트 근처 높은 위협 공 → `BLOCK`
4. 앞쪽/위쪽 공격 가능 공 → `SPIKE`
5. 곧 닿을 수 있는 높은 공 → `JUMP`
6. 그 외 → 예측 지점 또는 수비 홈으로 이동

### 이동

- 공이 자기 코트로 오면 예측 intercept 또는 낙하지점으로 이동한다.
- 공이 상대 코트에 있으면 profile별 수비 홈 위치로 복귀한다.
- 네트 근처 높은 공은 블로킹 위치를 우선 목표로 잡는다.
- 목표 X는 항상 court clamp를 거쳐 벽/네트에 붙는 움직임을 줄인다.

### 점프

- 현재 공 위치뿐 아니라 intercept tick을 보고 `jumpLeadTicks` 안에 닿을 수 있으면 미리 점프한다.
- profile별 lead bonus로 공격형은 더 빠르게, 수비형은 더 안정적으로 반응한다.

### 리시브

- 공이 자기 코트에 있고 낮아지며, 플레이어 주변 리시브 범위 안에 있을 때 사용한다.
- 수비형은 리시브 범위가 더 넓고, 공격형은 상대적으로 보수적으로 사용한다.

### 다이브

- 리시브로 닿기에는 멀지만 다이브 범위 안에서 곧 낮게 떨어지는 공에 사용한다.
- 무의미한 반복을 줄이기 위해 기본 cooldown을 유지하되, 매우 급한 상황에서는 짧은 잔여 cooldown을 무시할 수 있다.

### 블록

- 공이 네트 근처에서 높고, 상대가 점프/스파이크 위협을 보이거나 공이 넘어올 가능성이 있을 때 사용한다.
- 공격형은 블록 조건이 조금 완화되고 수비형은 조금 보수적이다.

### 스파이크

- 공이 플레이어 앞쪽에 있고, 공격 가능한 높이/거리 범위에 있을 때만 `ACTION`을 누른다.
- 오른쪽 2P 기준으로 공이 플레이어보다 왼쪽에 있어야 앞쪽으로 본다.

## 5. AI 타입별 차이

`AI_PROFILES`로 공격형/수비형/랠리형의 실제 판단 파라미터를 분리했다.

### aggressive

- 네트 접근과 블로킹/스파이크 조건이 더 적극적이다.
- 점프와 블록 lead tick이 더 빠르다.
- action cooldown scale이 낮아 공격 액션 재시도가 빠르다.

### defensive

- 수비 홈 위치를 더 뒤쪽에 둔다.
- 리시브/다이브 범위가 넓다.
- 무리한 스파이크/블록 조건은 상대적으로 줄였다.

### rally

- 예측 위치와 중앙 복귀를 균형 있게 사용한다.
- 극단적인 네트 접근을 줄이고 안정적인 리시브/점프 중심으로 플레이한다.

## 6. 튜닝 상수

주요 상수는 `BOT_TUNING`에 모았다.

- `predictionTicks`: 공 궤적을 예측하는 최대 tick 수. 늘리면 먼 미래 예측은 좋아지지만 현재 변화 반응이 둔해질 수 있다.
- `reactionDelayTicks`: AI 반응 지연. 늘리면 사람 같은 지연이 생기지만 수비력이 낮아진다.
- `moveDeadZone`: 목표 위치 근처에서 좌우 입력을 멈추는 거리. 늘리면 흔들림은 줄지만 정밀도가 낮아진다.
- `receiveRangeX`, `receiveRangeY`: 리시브 판단 범위.
- `diveRangeX`: 다이브로 커버 가능한 거리.
- `spikeRangeX`, `spikeRangeY`: 스파이크 가능 범위.
- `blockNetRange`, `blockXRange`: 블록 판단 범위.
- `jumpLeadTicks`, `blockLeadTicks`, `diveLeadTicks`: 액션을 미리 누르는 타이밍.
- `actionCooldowns`: 각 액션 재입력 최소 간격.

## 7. 테스트 결과

실행한 명령:

```bash
node --check src/game/ai/BotController.js
node --check src/sample.js
node test/ai-bot-smoke.mjs
sh build.sh
```

검증한 상황:

- 공이 자기 코트 낮은 위치로 올 때 `2P_DOWN` 리시브 입력 생성
- 공이 멀리 낮게 떨어질 때 `2P_DOUBLE_LEFT` 다이브 입력 생성
- 공이 네트 근처 높게 있을 때 `2P_DOUBLE_UP` 블록 입력 생성
- 공이 공격 가능한 위치에 있을 때 `2P_ACTION` 스파이크 입력 생성
- 공이 상대 코트에 있을 때 수비 홈 위치로 복귀 이동
- 일부 state 값이 없어도 크래시하지 않음
- `GameLoop + BotController` 조합으로 180tick 이상 실행해도 오류 없음

## 8. 남은 개선 과제

- 실제 브라우저 플레이에서 profile별 체감 난이도를 확인해야 한다.
- 상대 플레이어의 미래 액션까지 포함한 더 정교한 궤적 예측은 아직 구현하지 않았다.
- 네트 충돌 예측은 단순화되어 있으므로, 실제 히트박스 기반 예측으로 개선할 수 있다.
- 점수 상황에 따른 위험 감수 전략은 추후 추가할 수 있다.

## 9. 점프 서브 및 고속 공 대응 추가 튜닝

### 점프 서브

최신 `GameLogic`의 서브 상태(`phase: "serve"`, `serveStep: "ready" | "tossed"`, `server`, `serverSide`)를 BotController가 명시적으로 처리한다.

- `serveStep: "ready"`: `ACTION`으로 토스를 시작한다.
- `serveStep: "tossed"` + `serveTypes`에 `JUMP` 포함:
  - 공이 충분히 떠오르면 `UP`으로 점프한다.
  - 공중에서 공이 머리 위/팔 범위에 들어오면 `ACTION`으로 점프 서브를 친다.
  - 점프 타이밍을 놓쳤을 때는 폴트를 줄이기 위해 가능한 경우 오버핸드 서브로 fallback한다.

이전 로직은 `JUMP`와 `OVERHAND`를 모두 가진 캐릭터가 먼저 오버핸드 조건을 만족해 점프 서브를 거의 선택하지 못했다. 이제 모든 profile은 `JUMP`가 가능하면 우선 점프 서브를 시도하되, 타이밍을 놓치면 가능한 일반 서브로 fallback한다.

### 고속 공 대응

공 속도(`Math.hypot(vx, vy)`)를 예측과 액션 판단에 반영했다.

- 빠른 공은 예측 tick을 더 길게 잡아 자기 코트 진입 지점을 놓치지 않는다.
- 빠른 낙하 공은 낮은 공 판정 높이를 조금 올려 더 빨리 `RECEIVE`한다.
- 빠른 공은 리시브/다이브 허용 범위와 점프 lead tick을 확장한다.
- debug info에 `ballSpeed`를 추가해 고속 공 상황을 확인할 수 있다.

추가 검증:

```bash
node --check test/ai-bot-smoke.mjs
node test/ai-bot-smoke.mjs
```

추가 테스트 케이스:

- 서브 ready 상태에서 토스 `ACTION` 생성
- 점프 서브 가능 캐릭터가 tossed 상태에서 `UP` 생성
- 공중 점프 서브 타이밍에서 `ACTION` 생성
- 빠르게 낙하하는 공에 대해 더 이른 `RECEIVE` 생성
- 최신 `GameLoop + BotController` 240tick smoke simulation

## 10. Profile별 스킬 사용 자유도 튜닝

다이빙, 블로킹, 리시브가 너무 제한적으로 발동하지 않도록 `skillFreedom` profile 값을 추가하고, 주요 수비 스킬의 cooldown과 발동 조건을 완화했다.

### 공격형 aggressive

- 블로킹 범위와 타이밍 허용치를 가장 크게 확장했다.
- 네트 근처 위협 공에 대해 더 적극적으로 `DOUBLE_UP`을 사용한다.
- 공격 성향은 유지하되, 낮은 공을 완전히 놓치지 않도록 리시브/다이브 범위도 소폭 확장했다.

### 수비형 defensive

- 리시브와 다이브 범위를 가장 넓게 설정했다.
- 다이브 lead tick과 거리 허용치를 늘려 먼 낮은 공에 더 자주 몸을 던진다.
- 블로킹도 기존보다 조금 더 쉽게 쓰지만, 주된 정체성은 후방 수비와 안정적인 `RECEIVE` / `DIVE`다.

### 랠리형 rally

- 중간 높이에서 떨어지는 공을 더 빨리 `RECEIVE`하도록 조정했다.
- 다이브/블록 범위를 균형 있게 확장해, 극단적인 공격·수비보다 랠리 유지에 유리하게 했다.
- cooldown scale을 낮춰 중요한 순간에 같은 수비 스킬을 더 빨리 다시 사용할 수 있다.

추가 테스트 케이스:

- 공격형: 네트 근처 높은 공에서 더 넓은 위치에서도 `BLOCK`
- 수비형: 먼 낮은 공에서 더 적극적인 `DIVE`
- 랠리형: 중간 높이 낙하 공에서 조기 `RECEIVE`
