# AI Bot Send-Over Intent Report

## 1. 문제 상황

* AI가 낮은 공을 `RECEIVE` 또는 `DIVE`로 살리기는 하지만, 공을 상대 코트로 넘기지 못하고 자기 코트에서 리시브만 반복하는 상황이 있었다.
* 공격형, 수비형, 랠리형 성향 차이와 별개로 모든 봇에게 공통적인 “상대 코트로 넘기기” 목표가 부족했다.

## 2. 원인 분석

* 기존 판단 로직은 생존/수비 중심이었다. 낮은 공은 `RECEIVE`, 먼 공은 `DIVE`가 먼저 선택되어 자기 코트 안에서 공을 띄우는 결과가 많았다.
* `SPIKE`/클리어 계열 판단은 공격형 또는 이미 공중인 상황에 상대적으로 치우쳐 있었고, 수비형/랠리형이 공격 가능한 자기 코트 공을 넘기는 우선순위가 낮았다.
* `RECEIVE` 액션은 현재 `GameLogic`에서 공을 위로 띄우는 성격이 강하므로, 입력만으로 타구 방향을 직접 바꾸기 어렵다. 따라서 AI가 가능한 시점에 `ACTION`/점프/전진 압박을 더 빨리 선택해야 한다.

## 3. 수정 내용

* `src/game/ai/BotController.js`에 공통 `COMMON_SEND_OVER` 튜닝 값을 추가했다.
* 추가/수정한 주요 함수:
  * `shouldSendOver(state, prediction, profile, context)`
  * `canAttackOrClear(player, ball, context)`
  * `getOpponentCourtTargetX(state, botSide)`
  * `chooseSendOverAction(state, prediction, profile, context)`
  * `getSendOverUrgency(context, prediction, profile)`
  * `getSendOverPreparationX(context, prediction)`
* BotController 내부에만 유지되는 랠리 메모리를 추가했다.
  * `ownCourtTicks`
  * `consecutiveReceiveCount`
  * `lastSelectedAction`
  * `sendOverUrgency`
* 액션 우선순위를 조정했다.
  * 자기 코트에서 공이 공격/클리어 가능한 높이와 거리에 있으면 모든 profile이 `SEND_OVER_SPIKE` 또는 `SEND_OVER_JUMP`를 고려한다.
  * 낮고 가까운 공은 여전히 `RECEIVE`를 허용한다.
  * `RECEIVE`가 반복되거나 공이 자기 코트에 오래 머무르면 send-over urgency가 증가해 `ACTION`/점프 기반 넘기기 시도를 강화한다.
* profile별 차이는 유지했다.
  * `aggressive`: 더 빠르고 넓은 send-over 시도.
  * `defensive`: 안정적인 수비 성향을 유지하되 공격 가능한 공은 공통 send-over 로직으로 넘기기 시도.
  * `rally`: 무리한 공격은 줄이지만 자기 코트 체류/리시브 반복 시 넘기기 우선순위 증가.
* 방향 입력 보정:
  * 공을 넘기려는 액션 시점에 오른쪽 2P는 `LEFT`, 왼쪽 봇은 `RIGHT`를 함께 눌러 상대 코트 방향 압박을 준다.
  * 너무 멀리 있는 공에는 방향 보정을 적용하지 않아 공을 놓칠 위험을 줄였다.
* AI는 기존 원칙대로 state를 직접 수정하지 않고 입력 스냅샷만 생성한다.

## 4. 테스트 결과

실행한 명령:

```bash
node --check src/game/ai/BotController.js
node --check src/sample.js
node test/ai-bot-smoke.mjs
sh build.sh
```

통과한 검증:

* 공이 AI 코트에 있고 충분히 높은 위치에 있을 때 `SEND_OVER_SPIKE`/`ACTION` 입력이 생성됨.
* 공이 AI 코트에서 여러 tick 머무르면 `ownCourtTicks`와 send-over urgency 계열 debug 값이 증가함.
* `RECEIVE`가 반복되는 시나리오에서도 이후 send-over 액션을 시도함.
* 공이 낮고 가까운 경우에는 여전히 `RECEIVE`가 가능함.
* 공이 매우 낮고 멀리 떨어질 때 `DIVE`가 가능함.
* 공이 상대 코트에 있을 때는 무리한 공격 대신 수비 위치로 복귀함.
* `GameLoop + BotController` 시뮬레이션이 180tick 이상 오류 없이 유지됨.
* 일부 state 값이 없어도 크래시하지 않음.

실패 또는 제한 사항:

* 자동 테스트와 빌드는 통과했지만, 실제 브라우저에서 profile별 체감 공격성은 추가 시각 확인이 필요하다.

## 5. 남은 개선 과제

* 실제 플레이 테스트에서 아래 값을 추가 튜닝할 수 있다.
  * `COMMON_SEND_OVER.minOwnCourtTicksBeforeUrgency`
  * `COMMON_SEND_OVER.receiveRepeatLimit`
  * `COMMON_SEND_OVER.clearAttemptRange`
  * profile별 `sendOverAggression`, `sendOverRisk`
* 추후 디버그 UI에 표시하면 좋은 값:
  * `sendOverUrgency`
  * `selectedAction`
  * `targetX`
  * `predictedLandingX`
