# Asset Path Fix Report

## 1. 문제 상황
- 프로젝트 루트에서 `python3 -m http.server 5173`을 실행한 뒤 `http://127.0.0.1:5173/src/index.html`로 접속하면, 일부 asset 경로가 `/src/asset/...` 기준으로 해석되어 404가 발생했다.
- 확인된 404 대상은 `start.png`, `net.img.svg`, 캐릭터 PNG, `asset/sound` 하위 MP3/WAV 및 `배경음악.mp3` 등 정적 파일이었다.

## 2. 실제 파일 구조
- HTML entry 위치: `./src/index.html`
- asset 폴더 위치: `./asset`
- 대표 asset 파일:
  - `./asset/start.png`
  - `./asset/background.png`
  - `./asset/net.img.svg`
  - `./asset/character/히나타쇼요.png`
  - `./asset/sound/선택.mp3`

## 3. 원인
- `src/game/SpriteGen.js`에서 `new URL('../asset/...', import.meta.url)` 형태로 asset URL을 만들고 있었다.
- 이 코드는 `src/game/SpriteGen.js` 기준 상대경로로 평가되어 브라우저에서 `/src/asset/...`를 요청하게 된다.
- 실제 asset 폴더는 프로젝트 루트의 `/asset`이므로 해당 요청이 404가 되었다.

## 4. 수정 내용
- 수정한 파일 목록:
  - `src/index.html`
  - `src/game/SpriteGen.js`
- `src/index.html`의 favicon 경로를 `/asset/icon.png`로 변경했다.
- `src/game/SpriteGen.js`에 `ASSET_ROOT = '/asset'`와 `assetPath()` helper를 추가했다.
- 배경, 시작 이미지, 네트 SVG, 캐릭터 이미지, BGM, SFX 경로를 `/asset/...` 루트 기준 절대경로로 통일했다.
- `/asset/...`을 선택한 이유:
  - 현재 로컬 서버의 document root가 프로젝트 루트이므로 `/asset/...`이 실제 `./asset` 폴더를 안정적으로 가리킨다.
  - HTML, `src` 하위 JS, CSS 등 호출 위치가 달라도 동일한 기준으로 정적 asset을 참조할 수 있다.
  - `build.sh`는 `src` 내용을 `dist` 루트로 복사하고 `asset`을 `dist/asset`으로 복사하므로, dist를 정적 루트로 배포하는 경우에도 `/asset/...` 구조가 유지된다.

## 5. 검증 결과
- 상태/구조 확인:
  - `git checkout ai`
  - `git status --short`
  - `git branch`
  - `git remote -v`
  - `ls -l src/asset` (`src/asset` symlink 또는 디렉터리 없음)
  - `find . -maxdepth 3 -name "index.html"`
  - `find . -maxdepth 3 -type d -name "asset"`
  - `find asset -maxdepth 3 -type f | head -50`
- 경로 검색:
  - `grep -Rni "asset/" src . --exclude-dir=.git --exclude-dir=node_modules --exclude-dir=dist`
  - `grep -Rni "start.png\|background.png\|net.img.svg\|ball.img\|court.img\|character/\|sound/\|배경음악\|선택.mp3\|득점.mp3" src . --exclude-dir=.git --exclude-dir=node_modules --exclude-dir=dist`
- 문법 확인:
  - `node --check src/sample.js` 성공
  - `node --check src/game/SpriteGen.js` 성공
  - 요청서의 `src/engine/SpriteGen.js`는 현재 저장소에 없어 대신 실제 파일인 `src/game/SpriteGen.js`를 확인했다.
- 빌드 확인:
  - `sh build.sh` 성공
- HTTP 확인 (`python3 -m http.server 5173` 실행 후):
  - `curl -I http://127.0.0.1:5173/src/index.html` → `200 OK`
  - `curl -I http://127.0.0.1:5173/asset/start.png` → `200 OK`
  - `curl -I http://127.0.0.1:5173/asset/net.img.svg` → `200 OK`
  - `curl -I "http://127.0.0.1:5173/asset/character/%ED%9E%88%EB%82%98%ED%83%80%EC%87%BC%EC%9A%94.png"` → `200 OK`
  - `curl -I "http://127.0.0.1:5173/asset/sound/%EC%84%A0%ED%83%9D.mp3"` → `200 OK`
- 브라우저 확인:
  - Codex 인앱 Browser 연결 시도 결과 현재 `iab` 세션을 사용할 수 없어 직접 Network/Console 확인은 수행하지 못했다.
  - 정적 검색 기준으로 `/src/asset/...`를 생성하던 `../asset` 기반 runtime URL은 제거했다.

## 6. 남은 주의사항
- `AudioContext` autoplay 경고는 첫 사용자 입력 전 브라우저 정책으로 발생할 수 있으며, asset 404와는 별개다.
- `src/asset -> ../asset` symlink 방식은 임시 해결책이며 사용하거나 커밋하지 않았다.
- 배포 환경에서 base path가 프로젝트 루트가 아닌 하위 경로로 바뀌면 `/asset/...` asset root를 재검토해야 한다.
