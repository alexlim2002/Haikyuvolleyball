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
