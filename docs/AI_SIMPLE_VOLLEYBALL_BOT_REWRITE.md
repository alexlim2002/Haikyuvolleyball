# AI Simple Volleyball Bot Rewrite

## 1. 전면 수정 이유

* 기존 AI는 send-over, stamina, serve, receive-loop, spike/dive 제한 조건이 누적되면서 판단 경로가 지나치게 많아졌다.
* 그 결과 공이 상대 코트에 있거나 바닥에 가까운 상황에서도 Shift/Dive/Receive/Jump가 방정맞게 반복되는 문제가 있었다.
* 실제 배구처럼 “기다림 → 위치 선정 → 안정 리시브 → 후속 위치 → 필요한 순간 공격” 흐름이 부족했다.

## 2. 새 AI 철학

* 적게 움직이고, 필요한 순간만 입력한다.
* 공이 상대 코트에 있으면 공격/다이브하지 않고 기본 수비 위치로 돌아간다.
* 자기 코트로 들어오는 공은 먼저 낙하지점으로 이동하고 낮은 타점에서 안정 리시브한다.
* 다이브는 자기 코트, 바닥 직전, 이동 불가, 체력 충분 조건을 만족할 때만 쓰는 마지막 수단이다.
* Shift는 일반 랠리에서 공중 상태이며 x/y 타이밍이 맞을 때만 누른다.
* 리시브 후에는 공을 무시하지 않고 일정 시간 follow-up 상태로 공 아래/네트 방향 위치를 잡는다.
* 서브는 화려함보다 실패하지 않는 단순 순서를 우선한다.

## 3. 상태머신 구조

* `WAIT`: 상대 코트 공 또는 불확실한 상황에서 수비 홈 위치로 이동/대기.
* `RECEIVE`: 자기 코트의 낮고 받을 수 있는 공에만 리시브 입력.
* `RECOVER_AFTER_RECEIVE`: 리시브 직후 공을 다시 추적하고 후속 위치를 잡는 상태.
* `ATTACK_PREPARE`: 자기 코트의 높은 공 아래 또는 약간 네트 방향으로 접근.
* `JUMP_ATTACK`: 지상에서는 점프, 공중에서는 타이밍이 맞을 때만 Shift.
* `EMERGENCY_DIVE`: 바닥 직전이고 이동으로 못 받는 공에만 다이브.
* `SERVE`: serve phase 전용. 일반 랠리 판단과 분리.

## 참고한 피카츄 배구 AI 원칙

* 참고 저장소:
  * https://github.com/gorisanson/pikachu-volleyball
* 직접 복사한 코드는 없음.
* 참고한 판단 구조:
  * 예상 낙하지점이 자기 코트 밖이면 무리하지 않고 자기 진영의 대기 위치로 이동한다.
  * 공이 자기 코트에 들어올 때만 적극적으로 이동/점프/다이브를 고려한다.
  * 다이브는 자기 코트 안, 낮은 공, 플레이어와 멀리 떨어진 공에서만 선택한다.
  * 점프 중에 공과 가까울 때만 파워 히트를 고려한다.
  * 매 tick 모든 버튼을 누르지 않고 이동 방향, 점프, 파워 히트 중 필요한 입력만 고른다.
* 현재 프로젝트에 맞게 재해석한 부분:
  * `BotController.makeInputs(state)`가 반환하는 1P/2P 입력 스냅샷 구조를 유지했다.
  * `player2`, `ball`, `net`, `phase`, `serveStep`, `server` state 구조에 맞춰 판단한다.
  * stamina, action cooldown, `player.onGround`, `player.facing`을 Shift/Dive 제한에 반영했다.
  * 루트 `index.html` 및 `/asset/...` 구조는 건드리지 않았다.

## 4. 주요 판단 기준

* 공 위치: 자기 코트/상대 코트/자기 코트로 이동 중 여부.
* 공 높이: 낮은 공은 리시브, 충분히 높은 공은 공격 준비, 바닥 직전은 emergency 판단.
* 예상 낙하지점: 짧은 미래 궤적만 계산해 자기 코트 안으로 clamp한다.
* 체력: low stamina에서는 Shift/Dive를 억제하고 반복 리시브를 줄인다.
* `player.onGround`: 지상에서는 일반 Shift 금지, 공격하려면 먼저 점프한다.
* cooldown: Shift/Dive/Receive/Jump는 최소 간격을 둔다.

## 5. 캐릭터별 최소 보정

* 히나타: UNDERHAND 서브는 `ready → toss → wait → hit` 흐름으로 처리하고 지상 Shift를 금지한다.
* 아즈마네: 점프 서브 수비 중 성급한 좌우 다이브를 막고, 공중 타이밍에서만 공격한다.
* 카게야마: JUMP 서브는 toss 직후 바로 점프/Shift하지 않고, 공이 높고 내려오는 시점까지 기다린다.
* 츠키시마: low stamina에서 리시브 반복 대신 수비 위치/네트 방향 follow-up을 우선한다.
* 니시노야: 수비형이어도 무한 리시브하지 않고, 리시브 후 공 아래로 이동하거나 안정적으로 랠리를 이어간다.

## 6. 테스트 결과

실행한 명령:

```bash
node --check src/game/ai/BotController.js
node --check src/main.js
node test/ai-bot-smoke.mjs
node scripts/check-asset-paths.mjs
sh build.sh
```

통과 여부:

* 공이 상대 코트에 있을 때 Dive/Shift가 나오지 않는지 확인.
* 상대 점프 서브 직후 panic dive를 하지 않는지 확인.
* 빠른 서브가 자기 코트로 들어올 때 이동 또는 Receive를 우선하는지 확인.
* 지상 상태에서 일반 Shift가 나오지 않는지 확인.
* 리시브 후 follow-up 상태가 생기고, 지상에서는 Shift 대신 이동/Jump가 먼저 나오는지 확인.
* 공중에서 x/y 타이밍이 맞을 때만 Shift가 나오는지 확인.
* low stamina에서 Shift/Dive와 반복 Receive가 억제되는지 확인.
* UNDERHAND 서브와 JUMP 서브가 toss 후 기다리는 순서를 따르는지 확인.
* 180tick 이상 GameLoop 연동 및 부분 state 방어 테스트를 통과.

브라우저에서 확인해야 할 점:

* AI가 전체적으로 덜 방정맞게 움직이고, 공이 올 때까지 기다리는지.
* 리시브 후 공을 무시하지 않고 다음 위치를 잡는지.
* 히나타 UNDERHAND 서브가 실패만 반복하지 않는지.
* 카게야마 JUMP 서브가 너무 즉시 실행되지 않는지.
* 니시노야/츠키시마/카게야마 low stamina 상황에서 무한 리시브가 줄었는지.
* Network 탭에 `/src/asset/...` 404 요청이 없는지.
