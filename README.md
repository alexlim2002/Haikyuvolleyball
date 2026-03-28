# 하이큐 배구

피카츄 배구를 벤치마킹한 순수 HTML/CSS/JS PWA 게임.

---

## 모듈 방향 그래프

```mermaid
graph TD
    main["main.js"]
    GameBuilder
    AssetStore
    Effector
    Renderer
    InputSystem
    StateSystem
    EntityManager
    Game["Game (internal)"]
    swapKeyVal["utils/swapKeyVal"]
    Enum["utils/Enum"]
    GameLogic["game/GameLogic"]
    GameRule["game/GameRule"]
    KeyboardJson["game/Keyboard.json"]
    TouchJson["game/Touch.json"]

    main --> GameBuilder
    GameBuilder --> AssetStore
    GameBuilder --> Renderer
    GameBuilder --> Effector
    GameBuilder --> InputSystem
    GameBuilder --> Game

    AssetStore --> Effector

    InputSystem --> swapKeyVal
    InputSystem --> Enum

    Game --> StateSystem
    Game --> EntityManager

    StateSystem --> InputSystem
    StateSystem --> GameLogic
    StateSystem --> GameRule

    GameBuilder --> KeyboardJson
    GameBuilder --> TouchJson
```

---

## 레이어 규칙

| 접미사 | 역할 | 틱 종속 |
|--------|------|---------|
| `er` (Renderer, Effector) | 출력·소비 | Renderer=O, Effector=X |
| `System` (InputSystem, StateSystem) | 입력·생산 (스트림) | O |
| `Manager` (EntityManager) | 동적 등록/삭제 | X |
| `Store` (AssetStore) | 읽기전용 데이터 보관 | X |
| `Builder` (GameBuilder) | 초기화·조립 | X |

---

## 1틱 데이터 흐름

```mermaid
sequenceDiagram
    participant rAF as rAF 루프
    participant IS as InputSystem
    participant SS as StateSystem
    participant R as Renderer
    participant E as Effector

    rAF->>IS: next()
    IS-->>SS: inputs 스냅샷
    SS->>SS: tick(inputs) 상태전이
    SS->>R: draw(state)
    SS->>E: play*(interaction)
```