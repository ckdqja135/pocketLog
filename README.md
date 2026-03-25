# 🔴 Pokelog

**Git 커밋으로 포켓몬을 수집하는 CLI 게임**

커밋할 때마다 야생 포켓몬이 출현합니다. 잡고, 훈련하고, 진화시키고, 다른 트레이너와 대전하세요.

![Node.js](https://img.shields.io/badge/Node.js-18+-green)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue)
![License](https://img.shields.io/badge/license-MIT-yellow)

---

## 설치 & 실행

```bash
git clone https://github.com/your-repo/pokelog.git
cd pokelog
npm install
npm run build
npm start
```

개발 모드:
```bash
npm run dev
```

## 초기 설정

### 1. GitHub Personal Access Token 발급

1. GitHub 접속 → 우측 상단 프로필 → **Settings**
2. 좌측 하단 **Developer settings** → **Personal access tokens** → **Tokens (classic)**
3. **Generate new token (classic)** 클릭
4. 권한 선택: `repo` (전체 체크)
5. **Generate token** → `ghp_`로 시작하는 토큰 복사

### 2. pokelog에서 설정

```
pokelog> config
? GitHub Personal Access Token: ********    # 위에서 복사한 토큰
? 모니터링할 레포: *                         # * = 전체 레포, 또는 owner/repo (쉼표 구분)
```

설정 완료 후 자동으로 커밋을 폴링하며, 새 커밋마다 야생 포켓몬이 출현합니다.

---

## 명령어

### 포켓몬 수집

| 명령어 | 설명 |
|--------|------|
| `encounter` | 현재 조우 중인 야생 포켓몬 목록 |
| `catch` | 포켓몬 포획 시도 (볼 선택) |
| `bag` | 내 포켓몬 보관함 |
| `evolve` | 포켓몬 진화 (같은 종 3마리 필요) |
| `pokedex` | 포켓몬 도감 (수집률/희귀도별 통계) |

### 액션

| 명령어 | 설명 |
|--------|------|
| `hunt` | 지역 탐색으로 포켓몬 사냥 (스태미나 소모) |
| `train` | 포켓몬 훈련으로 레벨업 |
| `adventure` | 포켓몬을 모험에 파견 (방치형 보상) |
| `battle` | 다른 유저와 PVP 배틀 |

### 트레이너

| 명령어 | 설명 |
|--------|------|
| `status` | 내 통계 + 커밋 히트맵 |
| `badges` | 업적/뱃지 목록 (14종) |
| `leaderboard` | 리더보드 (온라인 시 글로벌) |

### 설정

| 명령어 | 설명 |
|--------|------|
| `config` | GitHub 토큰/레포 설정 |
| `online` | Supabase 온라인 모드 설정 |
| `settings` | 폴링 간격/브랜치 설정 |

---

## 핵심 시스템

### 조우 & 포획

커밋이 감지되면 야생 포켓몬이 출현합니다 (Gen 1~3, 386종).

- **희귀도**: Common(60%) → Uncommon(25%) → Rare(10%) → Legendary(4%) → Mythical(1%)
- **포획률**: 포켓몬 레벨, 볼 종류, 연속 커밋 보너스에 따라 결정
- **볼 해금**: 몬스터볼(기본) → 그레이트볼(30커밋) → 울트라볼(100커밋) → 마스터볼(300커밋)

### 사냥 (hunt)

스태미나를 소모해 직접 포켓몬을 찾으러 갑니다.

| 지역 | 스태미나 | Common | Rare | Legendary | Mythical |
|------|---------|--------|------|-----------|----------|
| 🌿 풀숲 | 1 | 60% | 8% | 1.5% | 0.5% |
| 🪨 동굴 | 2 | 20% | 30% | 8% | 2% |
| 🌊 바다 | 3 | 10% | 40% | 18% | 7% |

### 훈련 (train)

포켓몬을 훈련시켜 경험치를 얻고 레벨업합니다.

| 유형 | EXP | 비용 |
|------|-----|------|
| 💪 기본 훈련 | +5 | 무료 |
| 🏋️ 강화 훈련 | +15 | 스태미나 1 |
| 🎯 특훈 | +30 | 스태미나 3 |

- 레벨업 공식: 필요 EXP = 현재 레벨 x 10
- 최대 레벨: 100
- HP = 레벨 x 5 + 20 / MP = 레벨 x 3 + 10

### 모험 (adventure)

포켓몬을 모험에 보내면 시간 경과 후 보상을 받습니다.

| 유형 | 시간 | EXP | 스태미나 | 포켓몬 발견 |
|------|------|-----|---------|------------|
| 🏃 단거리 | 10분 | 10~20 | +1~2 | - |
| 🧭 중거리 | 30분 | 25~50 | +2~3 | 30% |
| 🗺️ 장거리 | 60분 | 50~100 | +3~5 | 60% |

### PVP 배틀 (battle)

다른 유저와 턴제 포켓몬 배틀을 합니다.

- **실제 기술**: PokeAPI에서 각 포켓몬의 진짜 기술을 불러옴 (한국어)
- **HP/MP**: 스킬 사용 시 MP 소모, 방어 시 MP 회복
- **상태이상**: 🔥 화상(매 턴 6% 데미지), ⚡ 마비(25% 행동불가)
- **보상**: 승리 시 EXP + 스태미나 획득
- **쿨다운**: 배틀 후 5분 대기

### 스태미나

사냥/훈련/배틀의 공통 자원입니다.

- 최대: 10
- 충전: 커밋 1회 = ⚡+1 / 모험 보상 / 배틀 승리(+2)

---

## 온라인 멀티플레이어 (Supabase)

Supabase를 연동하면 다른 유저와 기록을 공유할 수 있습니다.

### 설정 방법

1. [supabase.com](https://supabase.com) 에서 무료 프로젝트 생성
2. SQL Editor에서 테이블 생성:

```sql
CREATE TABLE trainers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  github_username TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  total_commits INTEGER DEFAULT 0,
  total_caught INTEGER DEFAULT 0,
  total_battle_wins INTEGER DEFAULT 0,
  pokedex_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE battle_teams (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trainer_id UUID REFERENCES trainers(id),
  github_username TEXT NOT NULL,
  team_data JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE battle_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  challenger TEXT NOT NULL,
  opponent TEXT NOT NULL,
  challenger_pokemon TEXT NOT NULL,
  opponent_pokemon TEXT NOT NULL,
  result TEXT NOT NULL,
  exp_gained INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE leaderboard (
  github_username TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  total_commits INTEGER DEFAULT 0,
  total_caught INTEGER DEFAULT 0,
  battle_wins INTEGER DEFAULT 0,
  battle_losses INTEGER DEFAULT 0,
  pokedex_count INTEGER DEFAULT 0,
  score INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

3. pokelog에서 연결:
```
pokelog> online
? Supabase URL: https://xxxxx.supabase.co
? Supabase Anon Key: eyJ...
? GitHub 유저네임: your-github-id
? 트레이너 이름: 원하는 닉네임
```

### 공유되는 데이터

| 기능 | 설명 |
|------|------|
| 글로벌 리더보드 | 점수 = 커밋x1 + 포획x5 + 승리x10 + 도감x3 |
| 배틀 팀 | 내 팀을 서버에 등록, 상대 팀 검색 |
| PVP 전적 | 대전 결과 기록 및 상대별 승/패 추적 |

Supabase 미설정 시 모든 기능이 로컬에서 정상 동작합니다.

---

## 기술 스택

| 구분 | 기술 |
|------|------|
| 런타임 | Node.js 18+ |
| 언어 | TypeScript (ES2022) |
| 로컬 DB | better-sqlite3 |
| 원격 DB | Supabase (PostgreSQL) |
| HTTP | got |
| CLI UI | chalk, inquirer, figlet, terminal-image |
| 스케줄링 | node-cron |
| API | GitHub API, PokeAPI v2 |

---

## 프로젝트 구조

```
src/
├── index.ts              # 메인 REPL
├── commands/
│   ├── catch.ts          # 포획
│   ├── encounter.ts      # 조우 목록
│   ├── bag.ts            # 보관함
│   ├── evolve.ts         # 진화
│   ├── pokedex.ts        # 도감
│   ├── hunt.ts           # 사냥
│   ├── train.ts          # 훈련
│   ├── adventure.ts      # 모험
│   ├── battle.ts         # PVP 배틀
│   ├── status.ts         # 트레이너 통계
│   ├── badges.ts         # 업적
│   ├── leaderboard.ts    # 리더보드
│   ├── config.ts         # 설정
│   ├── online.ts         # 온라인 모드
│   ├── settings.ts       # 폴링 설정
│   └── help.ts           # 도움말
├── services/
│   ├── database.ts       # SQLite (로컬)
│   ├── supabase.ts       # Supabase (온라인)
│   ├── pokemon.ts        # PokeAPI 연동
│   ├── poller.ts         # GitHub 커밋 폴링
│   └── battle.ts         # 배틀 엔진 (스킬/AI)
├── types/
│   └── index.ts          # 타입 정의
└── ui/
    ├── banner.ts         # 시작 화면
    └── display.ts        # 포켓몬 이미지/UI
```

---

## 라이선스

MIT
