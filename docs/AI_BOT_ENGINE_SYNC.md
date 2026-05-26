# AI Bot Engine Sync Report

## 1. 작업 개요
- 작업 목적: 기존 `ai` 브랜치의 2P AI 봇을 최신 `origin/main`의 `GameLoop`/`GameLogic`/`InputSystem` 기반 엔진 흐름에 맞게 동기화했다.
- 기준 브랜치: `ai`
- 반영한 원격 브랜치: `origin/ai`, `origin/main`
- 작업 날짜: 2026-05-26

## 2. 엔진 변경사항 요약
- 새 엔진의 tick 흐름:
  1. `src/sample.js`의 고정 60TPS accumulator 루프가 입력 스냅샷을 읽는다.
  2. `GameLoop.tick(state, inputs)`가 플레이어 액션 전이, 중력/이동, 공 물리, 충돌/액션 범위 이벤트를 처리한다.
  3. `StateSystem.setState(nextState)`로 다음 상태를 저장한다.
  4. `Renderer.draw()`가 현재 상태와 `EntityManager`의 엔티티 정의를 기준으로 렌더링한다.
- 입력 스냅샷 처리 방식:
  - `InputSystem`은 `1P_LEFT`, `2P_ACTION`, `2P_DOUBLE_UP` 같은 문자열 키를 가진 boolean 스냅샷을 매 tick 제공한다.
  - AI는 이 스냅샷을 직접 대체하지 않고, 2P 관련 키만 생성한 뒤 `sample.js`의 `withBotInputs()`에서 기존 입력 위에 덮어쓴다.
- state 구조에서 AI가 참조하는 값:
  - `state.player2`: AI가 조작하는 플레이어의 `x`, `y`, `vx`, `vy`, `facing`, `onGround`, `actionType`.
  - `state.player1`: 상대 플레이어 위치 참고용.
  - `state.ball`: 공의 `x`, `y`, `vx`, `vy`, `actionRangeCooldown`.
  - `state.net`: 네트 위치 `x`.
  - `state.score`, `state.sets`, `state.phase`: 랠리 전환 감지 및 AI 타입/쿨다운 초기화용.
- 기존 AI 코드와 맞지 않았던 부분:
  - 기존 봇은 `state.p2`, `state.p1`, 픽셀 단위 좌표, `ground`, `minX`, `maxX`, `rallyNumber`에 의존했다.
  - 최신 엔진은 `player1`/`player2` 키와 물리 단위 좌표를 사용하고, 액션 전이는 `GameLogic.handlers.resolveAction()`에서 입력 스냅샷을 읽어 수행한다.

## 3. AI 봇 구조
- AI 파일 위치: `src/game/ai/BotController.js`
- 연결 위치: `src/sample.js`
- 주요 함수 설명:
  - `createBotController(config)`: AI 컨트롤러 생성. 기본값은 오른쪽 `player2`를 조작한다.
  - `makeInputs(state)`: 매 tick 현재 state를 읽고 2P 입력 스냅샷 조각을 반환한다.
  - `readContext(state, cfg)`: 최신 state 구조에서 player/ball/net 정보를 추출하고, 코트 범위와 기본 위치를 계산한다.
  - `predictLandingX(context)`: 공 속도와 중력을 간단히 시뮬레이션해 예상 낙하지점을 추정한다.
  - `chooseTargetX()`, `moveToTarget()`, `chooseAction()`: 이동 목표와 액션 입력을 결정한다.
- state를 읽는 방식:
  - AI는 `state`를 읽기만 하며, 플레이어/공 좌표를 직접 수정하지 않는다.
- 입력/action을 반환하는 방식:
  - `2P_LEFT`, `2P_RIGHT`, `2P_UP`, `2P_DOWN`, `2P_ACTION`, `2P_DOUBLE_UP`, `2P_DOUBLE_LEFT`, `2P_DOUBLE_RIGHT` 같은 boolean 입력을 반환한다.
  - 실제 액션(`RUN`, `JUMP`, `RECEIVE`, `BLOCK`, `DIVE`, `SPIKE`) 전이는 `GameLogic.resolveAction()`이 담당한다.
- playerSide 처리 방식:
  - `playerSide: 'right'`면 `2P_*`, `'left'`면 `1P_*` 입력 이름을 생성한다.
  - 코트 판정도 `playerSide`와 `state.net.x`를 기준으로 좌/우를 나눠 계산한다.

## 4. AI 판단 로직
- 수비 위치 복귀:
  - 공이 상대 코트에 있거나 아직 자기 쪽으로 오지 않으면 봇 타입별 기본 위치로 복귀한다.
  - 공격형은 네트 근처, 수비형은 후방, 랠리형은 중간 위치를 선호한다.
- 공 예측:
  - 공의 현재 `x/y/vx/vy`와 `ballGravity`를 이용해 최대 180tick까지 예상 위치를 계산한다.
  - 좌우 벽과 네트에 대한 간단한 반사 보정도 포함한다.
- 이동 판단:
  - 예상 낙하지점 또는 타입별 기본 위치로 이동한다.
  - 목표와 현재 위치 차이가 `moveMargin`보다 작으면 불필요한 좌우 입력을 멈춘다.
- 점프 판단:
  - 공이 높고 가로로 가까우며 플레이어가 지상에 있을 때 `UP`을 입력한다.
- 리시브/다이브 판단:
  - 낮고 떨어지는 공이 가까우면 `DOWN`으로 `RECEIVE`를 시도한다.
  - 낮은 공이 약간 멀지만 같은 코트 안에 있으면 `DOUBLE_LEFT`/`DOUBLE_RIGHT`로 `DIVE`를 시도한다.
- 블록/스파이크 판단:
  - 공이 네트 근처에서 높고 자기 쪽으로 오면 `DOUBLE_UP`으로 `BLOCK`을 시도한다.
  - 공중에서 공이 닿을 만한 위치에 있으면 `ACTION`으로 `SPIKE`를 시도한다.
- cooldown 또는 난사 방지 로직:
  - `diveCooldown`, `jumpCooldown`, `spikeCooldown`, `receiveCooldown`, `blockCooldown`을 둬 같은 액션을 매 tick 난사하지 않게 했다.

## 5. 수정 파일 목록
- `src/game/ai/BotController.js`
  - 변경 이유: 구 엔진의 픽셀 좌표/state 구조/`rallyNumber` 의존을 최신 엔진의 물리 단위와 입력 스냅샷 흐름에 맞추기 위해 수정.
  - 주요 변경 내용: 최신 `player1`/`player2`/`ball`/`net` state 읽기, `playerSide` 기반 입력 생성, 공 낙하지점 예측, 타입별 위치/액션 판단, 쿨다운 추가.
- `src/sample.js`
  - 변경 이유: 최신 실행 진입점이 `src/index.html`에서 `sample.js`를 로드하므로 이곳에 AI 입력 주입 지점을 추가해야 했다.
  - 주요 변경 내용: `createBotController()` import/생성, `withBotInputs()`로 2P 입력만 AI 입력으로 덮어쓰기, HUD에 현재 AI 타입 표시.
- `docs/AI_BOT_ENGINE_SYNC.md`
  - 변경 이유: 작업 내용, 엔진 분석, 테스트 결과, 남은 문제를 문서화하기 위해 생성.
  - 주요 변경 내용: 엔진 tick 흐름, AI 구조, 판단 로직, 테스트 결과, 남은 작업 기록.

## 6. 테스트 결과
실행한 명령:
- `git fetch origin --prune`
- `git merge origin/main`
- `node --check src/game/ai/BotController.js`
- `node --check src/sample.js`
- `sh build.sh`
- `python3 -m http.server 5173` 후 `curl -I http://127.0.0.1:5173/index.html`
- `node --input-type=module` 기반 `BotController` smoke test
- `node --input-type=module` 기반 `GameLoop + BotController` 180tick 시뮬레이션
- 저공/네트 근처 고공/공중 도달 상태별 AI 입력 생성 확인

결과:
- 성공:
  - JS 문법 검사 통과.
  - `build.sh` 실행 성공. 단, 생성된 `dist/`는 빌드 산출물이므로 커밋에서 제외했다.
  - 로컬 HTTP 서버에서 `index.html`이 200 OK로 응답.
  - BotController가 최신 state에서 `2P_*` 입력을 정상 생성함을 확인.
  - GameLoop와 함께 180tick 동안 `player1`, `player2`, `ball`, `net` state가 `undefined`/`NaN` 없이 유지됨을 확인.
  - 상황별로 `2P_DOWN`, `2P_DOUBLE_UP`, `2P_ACTION` 입력 생성 확인.
- 실패/제한:
  - Codex 인앱 Browser의 `iab` 세션을 사용할 수 없어 브라우저 콘솔 검증을 완료하지 못했다.
  - 로컬 Playwright 패키지는 CLI만 캐시에 있고 브라우저 실행 파일이 설치되어 있지 않아 headless 콘솔 검증도 실패했다. 실패 메시지는 `npx playwright install`로 브라우저를 설치해야 한다는 내용이었다.

## 7. 남은 작업
- 실제 브라우저 환경에서 게임을 열어 콘솔 에러와 AI 움직임을 시각적으로 최종 확인해야 한다.
- 현재는 2P를 AI가 항상 덮어쓴다. 사람이 2P를 조작하는 모드와 AI 모드를 전환하려면 별도 토글 UI가 필요하다.
- 공격형/수비형/랠리형은 매 랠리마다 랜덤 선택된다. 디버깅/시연용으로 타입 고정 옵션을 추가하면 좋다.
- 공 예측은 단순 시뮬레이션이므로 네트/플레이어 충돌 이후의 복잡한 궤적은 완전히 정확하지 않다.
