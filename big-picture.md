# Pokemon Clone — Big Picture Roadmap

## Vision
브라우저에서 동작하는 포켓몬 스타일 RPG 클론을 만들고, 탐험·전투·성장 루프를 중심으로 플레이 가능한 MVP를 빠르게 완성한다.

## Product Goals
- 타일 기반 월드 탐험
- 랜덤 인카운터 기반 턴제 전투
- 몬스터 포획/육성/진화 핵심 루프
- 저장/불러오기 가능한 싱글 플레이 경험

## Scope (MVP)
1. **Overworld**
   - 플레이어 이동(상하좌우)
   - 맵 전환(마을 ↔ 필드)
   - 충돌 처리(벽/장애물)
2. **Encounter & Battle**
   - 풀숲/특정 타일에서 랜덤 인카운터
   - 1:1 턴제 전투(공격/스킬/아이템/도망)
   - HP, 상태 이상(선택), 경험치/레벨업
3. **Monster System**
   - 기본 스탯(HP/공격/방어/속도)
   - 기술 슬롯(최대 4개)
   - 포획 로직(볼/확률)
4. **Inventory & Economy**
   - 회복 아이템/포획 볼
   - 상점 구매(간단한 통화 시스템)
5. **Persistence**
   - 로컬 저장(세이브 슬롯 1개 이상)

## Out of Scope (v1 이후)
- 온라인 대전/교환
- 복잡한 스토리 연출
- 수백 종 몬스터/대규모 도감
- 멀티 플랫폼 네이티브 앱 배포

## Technical Direction
- Frontend: TypeScript + (Phaser 또는 Pixi + custom loop)
- State: 전역 상태 관리(예: Zustand/Redux 또는 경량 커스텀)
- Data: JSON 기반 몬스터/스킬/아이템 정의
- Persistence: LocalStorage(초기), 이후 IndexedDB 고려
- Tooling: ESLint/Prettier, Vitest/Jest, GitHub Actions CI

## Milestones

### M1 — Project Foundation (1주)
- 프로젝트 셋업(빌드/린트/테스트)
- 기본 렌더 루프 및 타일맵 로딩
- 캐릭터 이동 + 카메라 추적

### M2 — Core Exploration (1주)
- 충돌/맵 전환
- 랜덤 인카운터 트리거
- UI 프레임(메뉴/대화창)

### M3 — Battle MVP (2주)
- 턴제 전투 상태머신
- 기본 스킬 10개 내외
- 데미지/명중/행동 순서 계산

### M4 — Capture & Progression (1주)
- 포획 확률 공식 도입
- 경험치/레벨업/기술 습득
- 파티 관리(최대 6)

### M5 — Playable Loop & Polish (1주)
- 상점/아이템 루프
- 세이브/로드
- 밸런스 1차 패스, 버그 수정

## Deliverables
- 플레이 가능한 웹 빌드 1종
- 몬스터/스킬/아이템 데이터 시트
- 간단한 개발 문서(시스템 개요 + 아키텍처)

## Risks & Mitigations
- **리스크:** 전투 상태 복잡도 증가  
  **대응:** 상태머신 패턴으로 전투 흐름 고정
- **리스크:** 콘텐츠 제작 병목  
  **대응:** 데이터 드리븐 구조로 JSON 대량 편집 가능화
- **리스크:** 밸런스 난이도  
  **대응:** 로그/시뮬레이션 기반 수치 튜닝

## Definition of Done (MVP)
- 시작 → 탐험 → 전투 → 포획/성장 → 저장까지 끊김 없이 30분 플레이 가능
- 치명적 버그(Crash/Progress blocker) 0건
- 기본 UX(키 입력, 메뉴 흐름, 피드백) 완성
