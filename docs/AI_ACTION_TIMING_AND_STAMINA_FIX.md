# AI Action Timing and Stamina Fix

## 1. 문제 상황

* Shift 스파이크 남발: send-over 의도가 생기면 공 높이/점프 여부와 무관하게 `ACTION`을 누르는 상황이 있었다.
* 바닥 스파이크: 공중 공격 타이밍이 아닌 지상 상태에서도 Shift가 반복되어 stamina만 소모했다.
* 다이브 남발: 공이 상대 코트에 있거나 이동으로 받을 수 있는 상황에서도 다이브를 고르는 경우가 있었다.
* UNDERHAND 서브 실패: 토스 직후 wait-fall 없이 Shift를 반복해 언더핸드 타격 타이밍을 놓쳤다.
* 무한 리시브: 체력이 낮거나 공이 자기 코트에 오래 머무를 때 리시브만 반복하는 루프가 남아 있었다.
* 체력 부족 시 잘못된 행동: stamina가 낮아도 Spike/Dive 같은 고비용 입력을 쉽게 선택했다.

## 2. 원인 분석

* send-over intent가 조건 없는 Shift로 이어져 실제 게임의 “띄우기 → 접근 → 점프 → 타격” 절차가 부족했다.
* 스파이크 준비 단계가 약해 지상 상태에서 공격 입력이 먼저 나갔다.
* 다이브 조건이 느슨해 자기 코트/착지 임박/이동 불가 여부를 충분히 확인하지 않았다.
* 서브와 일반 랠리 입력을 별도 상태로 분리하지 않아 serve toss 이후 Shift 재입력을 억제하지 못했다.
* stamina, facing, action cooldown, post-action recovery를 함께 고려하는 방어 로직이 부족했다.

## 3. 수정 내용

* BotController 내부 메모리에 plan/tick/action 기록을 확장했다.
  * `currentPlan`, `lastAction`, `lastActionTick`, `lastSpikeTick`, `lastDiveTick`, `lastReceiveTick`, `postDiveRecoveryUntil`, `postSpikeRecoveryUntil`, `lastDiveDirection`, `serveState`, `serveTossTick` 등을 사용한다.
* 스파이크 조건을 강화했다.
  * `canSpikeNow`, `shouldPrepareSpike`, `shouldJumpForSpike`, `isAirborneAttackWindow`를 추가해 지상 Shift를 막고 공중/높이/x거리/facing/stamina/cooldown을 만족할 때만 `ACTION`을 허용한다.
* 다이브 조건을 강화했다.
  * 공이 자기 코트에 있고, 착지/저공 위기가 임박했으며, 이동으로 도달하기 어려운 상황에서만 다이브한다.
  * post-dive recovery와 방향 전환 lock을 추가해 좌/우 다이브 반복을 억제했다.
* 리시브 루프를 완화했다.
  * 반복 리시브/own-court 압박이 쌓이면 무조건 다시 receive하지 않고 네트 방향 setup/접근으로 전환한다.
* 서브 로직을 분리했다.
  * UNDERHAND는 toss 후 상승 구간을 기다리고, 낙하 및 낮은 타점에서만 1회 hit한다.
  * JUMP/OVERHAND 가능 캐릭터는 tossed 직후 즉시 Shift하지 않고 reaction/wait window 후 점프/타격한다.
* stamina-aware 선택을 강화했다.
  * 낮은 stamina에서는 Spike/Dive를 강하게 제한하고, 가까운 저공 공은 save 후 네트 방향 setup을 우선한다.
* facing 보정을 유지했다.
  * 공을 넘기려는 준비/타격 시 오른쪽 AI는 왼쪽, 왼쪽 AI는 오른쪽 입력으로 상대 코트 방향을 보정한다.

## 4. 캐릭터별 보정

* 히나타: UNDERHAND serve가 toss → wait-fall → hit 순서를 따르며, 지상 Shift 남발이 억제된다.
* 아즈마네: dive cooldown/recovery/direction lock으로 좌우 다이브 반복을 줄이고, 공격 가능한 공중 공에서만 스파이크한다.
* 카게야마: jump serve가 tossed 직후 즉시 hit하지 않고 wait/reaction window를 둔 뒤 점프/타격한다.
* 츠키시마: low stamina와 반복 receive 상황에서 네트 방향 setup으로 전환해 뒤돌아 무한 receive하는 상황을 줄인다.
* 니시노야: 수비형 receive는 유지하되, 공이 뜬 뒤 지상 Shift 대신 접근/점프 준비를 우선한다.

## 5. 테스트 결과

실행한 명령:

```bash
node --check src/game/ai/BotController.js
node --check src/main.js
node test/ai-bot-smoke.mjs
node scripts/check-asset-paths.mjs
sh build.sh
```

통과한 테스트:

* 낮고 빠른 공에서 ground Shift가 나오지 않음.
* 상대 코트 공에서 dive가 나오지 않음.
* 이동으로 받을 수 있는 자기 코트 공에서 dive가 억제됨.
* 높은 공 + 지상 상태에서는 Shift가 아니라 setup/jump 계열을 먼저 선택함.
* 공중 공격 창에서만 Shift spike가 선택됨.
* spike cooldown/recovery로 같은 공에 대한 연속 Shift가 억제됨.
* low stamina에서 Spike/Dive가 억제됨.
* UNDERHAND serve가 toss 후 wait-fall/hit 순서를 따름.
* jump serve가 즉시 Shift하지 않음.
* 180tick 이상 GameLoop 연동 및 부분 state smoke test가 통과함.

실패 또는 제한 사항:

* 자동 테스트는 통과했지만 실제 캐릭터별 체감 타이밍은 브라우저 플레이로 추가 확인이 필요하다.

## 6. 수동 브라우저 테스트 체크리스트

* 히나타 UNDERHAND 서브: 공을 띄운 뒤 내려오는 타이밍에만 R.Shift를 누르는지 확인한다.
* 아즈마네 다이브 남발 여부: 점프 서브 수신 후 좌/우 다이브를 즉시 반복하지 않는지 확인한다.
* 카게야마 서브 속도/타이밍: tossed 직후 바로 Shift하지 않고 반응 가능한 window가 있는지 확인한다.
* 츠키시마 무한 리시브 여부: low stamina에서 뒤쪽을 보고 receive만 반복하지 않는지 확인한다.
* 니시노야 바닥 Shift 남발 여부: receive 후 공이 떴을 때 지상 Shift만 반복하지 않는지 확인한다.
* low stamina 상황: Spike/Dive 빈도가 줄고 네트 방향 setup이 우선되는지 확인한다.
* `/src/asset/...` 404 여부: Network 탭에서 `/src/asset/` 요청이 없는지 확인한다.

## 7. 2차 수정: Serve Receive and Follow-up Decisions

### 플레이어 점프 서브 대응 로직

* 상대가 서브 중이거나 직전 서버가 상대이고 공이 빠르게 AI 코트로 향하는 경우를 `isOpponentServeThreat` / `isOpponentJumpServeIncoming`으로 별도 감지한다.
* 상대 점프 서브 공이 아직 상대 코트에 있으면 다이브를 금지하고 예상 낙하지점으로 먼저 이동한다.
* 빠른 서브가 자기 코트에 들어왔고 리시브 가능한 높이/거리이면 `SERVE_RECEIVE`를 우선 선택한다.

### Shift 남발 추가 억제

* 기존 airborne-only spike 조건에 더해 `lastShiftTick`, `postShiftRecoveryUntil`, `postShiftRecoveryTicks`를 추가했다.
* 일반 랠리에서 지상 Shift는 계속 금지되며, 최근 Shift 이후 recovery가 끝나기 전에는 다시 Shift하지 않는다.
* serve hit도 내부 Shift recovery에 기록해 서브 중 Shift 반복을 줄인다.

### 리시브 후 follow-up plan

* RECEIVE 또는 SERVE_RECEIVE 이후 `postReceivePlanUntil`, `receivedBallRecently`, `plannedFollowUpAction`을 기록한다.
* 공이 자기 코트에서 떠 있으면 `APPROACH_ATTACK`, `FOLLOW_UP_JUMP_ATTACK`, `SAFE_SEND_OVER` 중 하나를 유지한다.
* 지상 상태에서는 즉시 Shift하지 않고 접근 또는 점프를 우선한다.
* 공중에서 높이/거리/facing/stamina 조건이 맞을 때만 follow-up spike를 허용한다.

### low stamina receive suppression

* `shouldSuppressReceiveByStamina`를 추가해 low/critical stamina에서 반복 리시브를 제한한다.
* 아주 낮은 emergency 공은 한 번 살릴 수 있지만, 이후에는 네트 방향 이동 또는 safe send-over plan으로 전환한다.
* 랠리형/수비형 profile도 receive-only loop에 빠지지 않도록 공통 적용했다.

### 히나타 UNDERHAND 서브 수정

* UNDERHAND-only 캐릭터는 `SERVE_PREPARE → SERVE_TOSS → SERVE_WAIT_FALL → SERVE_HIT` 흐름을 유지한다.
* toss 직후와 공 상승 중에는 Shift를 금지한다.
* 공이 내려오고 낮은 타격 가능 높이에 들어왔을 때만 Shift를 한 번 입력하며, hit 이후 같은 tossed 상태에서 Shift를 반복하지 않는다.

### 카게야마 jump serve timing 수정

* JUMP serve는 toss 직후 점프하지 않고 `jumpServeMinWaitTicks` 이후에도 공이 실제로 하강(`ball.vy <= 0`)해야 점프한다.
* airborne hit도 공이 하강 중이고 높이/거리 window가 맞을 때만 허용한다.
* GameLoop smoke에서 카게야마식 jump serve가 toss 후 충분히 기다린 뒤 점프하도록 확인했다.

### 다이브 조건 강화

* `shouldAvoidDiveOnServe`와 `canReachByWalking`을 추가했다.
* 상대 서브 상황에서는 공이 자기 코트에 들어오기 전, 이동으로 받을 수 있는 경우, 바닥 직전이 아닌 경우 다이브를 금지한다.
* 일반 랠리에서도 다이브 높이 조건을 더 낮추고, 이동 가능하면 receive/positioning을 우선한다.

### 자동 테스트 결과

실행 대상:

```bash
node --check src/game/ai/BotController.js
node --check src/main.js
node test/ai-bot-smoke.mjs
node scripts/check-asset-paths.mjs
sh build.sh
```

2차로 추가/강화한 smoke 항목:

* 상대 점프 서브 직후 공이 상대 코트에 있을 때 다이브하지 않음.
* 빠른 상대 서브가 자기 코트로 들어올 때 `SERVE_RECEIVE` 우선.
* 리시브 후 공이 뜨면 follow-up plan이 유지됨.
* low stamina repeated receive 상황에서 receive suppression 및 net-direction follow-up 발생.
* jump serve가 toss 직후 바로 Shift/Jump하지 않고 낙하 구간에서 점프함.

### 브라우저 확인 항목

* 플레이어 점프 서브를 넣었을 때 AI가 무의미하게 왼쪽 다이브하지 않는지.
* AI가 빠른 서브를 위치 선정 후 안정적으로 RECEIVE하는지.
* 리시브 후 공을 무시하지 않고 접근/점프/안전 넘기기 후속 행동을 하는지.
* 히나타 UNDERHAND 서브가 toss 후 내려오는 공을 타격하는지.
* 카게야마 jump serve가 toss 직후가 아니라 공이 떨어질 때 점프/타격하는지.
* low stamina 상태에서 카게야마/츠키시마/니시노야가 receive-only loop에 덜 빠지는지.
* Network 탭에 `/src/asset/...` 요청이 없는지.
