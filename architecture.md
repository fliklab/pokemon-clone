# Pokemon Clone — Architecture

## 1. Architecture Goals
- 탐험(Overworld)과 전투(Battle)를 명확히 분리해 복잡도를 낮춘다.
- 데이터(JSON) 중심으로 몬스터/스킬/아이템 밸런싱을 쉽게 만든다.
- 저장/불러오기 흐름을 단순하고 안전하게 유지한다.
- MVP 기준에서 빠른 구현과 확장성을 함께 확보한다.

## 2. High-Level Structure

```text
src/
  core/
    game.ts                # 게임 부트스트랩, 메인 루프 진입
    scene-manager.ts       # 씬 전환(Overworld <-> Battle <-> Menu)
    event-bus.ts           # 도메인 이벤트 전달

  overworld/
    overworld-scene.ts     # 탐험 씬
    map-loader.ts          # 타일맵 로딩(TMX/JSON)
    collision-system.ts    # 충돌/통과 가능 타일 판정
    encounter-system.ts    # 랜덤 인카운터 트리거

  battle/
    battle-scene.ts        # 전투 씬
    battle-state-machine.ts# 턴 진행 상태머신
    turn-order.ts          # 행동 순서 계산(속도 기반)
    damage-formula.ts      # 데미지/명중 계산
    capture-formula.ts     # 포획 확률 계산

  domain/
    entities/
      monster.ts
      move.ts
      item.ts
      trainer.ts
    services/
      leveling-service.ts
      status-service.ts
    constants/
      types.ts
      balance.ts

  data/
    monsters.json
    moves.json
    items.json
    encounters.json

  state/
    store.ts               # 전역 게임 상태(파티, 인벤토리, 진행)
    selectors.ts
    actions.ts

  ui/
    emoji-renderer.ts      # 에셋 키를 emoji/pixel-art로 매핑하는 렌더러
    hud/
    menus/
    dialog/

  persistence/
    save-repository.ts     # 세이브/로드 인터페이스
    localstorage-adapter.ts# LocalStorage 구현체

  tests/
    battle/
    domain/
    persistence/
```

## 3. Runtime Flow
1. `core/game.ts`에서 엔진 초기화 후 `OverworldScene` 진입
2. 플레이어 이동 중 `encounter-system`이 인카운터 이벤트 발행
3. `scene-manager`가 `BattleScene`으로 전환
4. `battle-state-machine`이 턴을 순차 처리
   - 커맨드 선택 → 속도 계산 → 기술/아이템/도망 처리 → 승패 판정
5. 전투 종료 시 경험치/포획 결과를 `state/store`에 반영
6. `scene-manager`가 다시 `OverworldScene`으로 복귀
7. 메뉴에서 세이브 선택 시 `persistence` 계층이 상태 직렬화 후 저장

## 4. Core Design Decisions

### 4.1 Scene + State Machine
- 월드 탐험과 전투는 성격이 다르므로 씬 단위로 격리한다.
- 전투는 상태머신으로 고정된 순서를 강제해 버그를 줄인다.

### 4.2 Data-Driven Content
- 몬스터/기술/아이템 수치는 코드 하드코딩 대신 JSON으로 관리한다.
- 신규 콘텐츠 추가 시 로직 수정 없이 데이터만 확장 가능하도록 한다.

### 4.3 Thin Domain, Explicit Services
- 엔티티는 상태/규칙의 최소 단위만 보유한다.
- 경험치 계산, 상태이상 처리처럼 변동 가능성이 큰 규칙은 서비스로 분리한다.

### 4.4 Persistence Abstraction
- `SaveRepository` 인터페이스를 두고 구현체(LocalStorage) 분리.
- 추후 IndexedDB/클라우드 저장으로 교체 시 도메인 로직 영향 최소화.

## 5. State Model (MVP)
- `player`: 위치, 방향, 소지금, 진행 플래그
- `party`: 보유 몬스터(최대 6), 현재 HP/상태, 경험치
- `inventory`: 아이템 수량
- `world`: 현재 맵 ID, 맵별 이벤트 상태
- `meta`: 플레이 시간, 마지막 저장 시각, 버전

## 6. Save/Load Contract
- 저장 단위: 단일 세이브 슬롯(초기 MVP)
- 저장 시점: 메뉴 명시 저장 + 주요 이벤트 후 자동 저장(선택)
- 호환성: `saveVersion` 필드로 마이그레이션 분기
- 안정성: 저장 직렬화 실패 시 기존 세이브를 보존

## 7. Asset Rendering

이미지 에셋 준비 전 단계에서 `emoji`를 임시 렌더링 자원으로 사용하되, 나중에 픽셀아트로 쉽게 교체할 수 있도록 렌더링 진입점을 분리한다.

### 7.1 EmojiAssetRenderer
- `EmojiAssetRenderer`는 도메인에서 사용하는 `assetKey`를 받아 문자열(emoji 또는 pixel-art key)로 변환한다.
- 내부적으로 `emojiMap`을 사용해 `assetType`별 기본값을 제공한다.
- `assetKey`가 비어 있거나 매핑이 없는 경우 `assetType` fallback을 적용한다.

### 7.2 Runtime Toggle
- `config.emojiMode`가 `true`면 emoji를 반환한다.
- `config.emojiMode`가 `false`면 `pixelArtResolver` hook으로 전달해 픽셀아트 키를 반환한다.
- hook 미주입 시 최소 동작 보장을 위해 `assetKey` 자체를 반환한다.

### 7.3 Example Snippet

```ts
import { EmojiAssetRenderer } from './src/ui/emoji-renderer';

const renderer = new EmojiAssetRenderer({
  emojiMode: true,
  emojiMap: {
    monster: '🐾',
    trainer: '🧢',
    item: '🧪',
    move: '✨',
    unknown: '❔',
  },
  pixelArtResolver: (assetKey) => `pixel:${assetKey}`,
});

renderer.render('monster', 'pikachu'); // "🐾" (emojiMode=true)
```

## 8. Testing Strategy
- **Unit**
  - 데미지/포획/행동순서 공식
  - 레벨업/기술 습득 규칙
  - `EmojiAssetRenderer`의 fallback/모드 전환/pixel hook 동작
- **Integration**
  - 전투 1회전 흐름(커맨드 입력 → 판정 → 결과 반영)
  - 저장/불러오기 왕복 테스트
- **Smoke**
  - 시작 후 5분 플레이(이동/인카운터/전투/회복/세이브)

## 9. Observability & Debug (Dev)
- 전투 로그(턴, 명중 여부, 데미지 값) 출력
- 개발자용 디버그 패널(인카운터 강제, HP 조정, 아이템 지급)
- 치명 에러 발생 시 최소한의 복구 UI(타이틀 복귀)

## 10. Future Extension Points
- 온라인 대전용 `battle-transport` 추상화 계층
- AI 트레이너 행동 정책 모듈화
- 도감/퀘스트/스토리 이벤트 시스템 플러그인 구조
- `EmojiAssetRenderer`를 `AssetRenderer` 인터페이스 기반으로 교체해 픽셀아트/스프라이트시트 렌더러를 플러그인처럼 추가

---
이 문서는 MVP 구현 기준의 기준 아키텍처이며, 구현 진행에 따라 모듈 경계는 유지하되 내부 구조는 점진적으로 조정한다.
