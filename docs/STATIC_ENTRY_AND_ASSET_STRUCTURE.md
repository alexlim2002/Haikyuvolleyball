# Static Entry and Asset Structure

## 1. 정리 목적

`src/index.html`을 직접 실행하면 `asset/start.png` 같은 상대 asset 경로가 브라우저에서 `/src/asset/start.png`로 해석되어 404가 반복될 수 있다. 이 문서는 앱 진입점을 프로젝트 루트로 고정하고, 런타임 asset URL을 `/asset/...` 기준으로 통일해 같은 문제가 재발하지 않도록 하기 위한 기준이다.

## 2. 최종 실행 방식

서버 실행 명령:

```bash
python3 -m http.server 5173 --bind 127.0.0.1
```

브라우저 접속 주소:

```text
http://127.0.0.1:5173/
```

앞으로는 `/src/index.html`이 아니라 `/`로 접속한다. `src/index.html`은 호환용 안내/리다이렉트 파일이며 실제 앱 진입점은 루트 `index.html`이다.

## 3. 최종 파일 구조

* `index.html`: 프로젝트 루트의 실제 앱 진입점
* `src/`: JavaScript, CSS, 게임/엔진 소스 코드
* `asset/`: 이미지, SVG, 캐릭터 스프라이트, 사운드 등 정적 asset 원본
* `dist/`: `build.sh` 실행 시 생성되는 빌드 산출물. 커밋하지 않는다.

## 4. asset 경로 규칙

* HTML 정적 태그에서는 `/asset/...` 절대경로를 사용한다.
* JS에서는 `src/utils/assetPath.js`의 `assetPath(...)`를 우선 사용한다.
* `asset/...`, `./asset/...`, `../asset/...`, `/src/asset/...` 형태는 금지한다.
* `src/asset -> ../asset` 같은 symlink 방식은 임시 해결책이므로 금지한다.
* 새 이미지/사운드를 추가할 때도 파일은 `asset/` 아래에 두고, 런타임 참조는 `/asset/...` 또는 `assetPath(...)`로 만든다.

## 5. 검증 방법

문법/빌드 검증:

```bash
node --check src/main.js
node --check src/game/SpriteGen.js
node --check src/engine/Effector.js
node --check src/game/ai/BotController.js
node scripts/check-asset-paths.mjs
sh build.sh
```

서버와 curl 검증:

```bash
python3 -m http.server 5173 --bind 127.0.0.1
curl -I http://127.0.0.1:5173/
curl -I http://127.0.0.1:5173/index.html
curl -I http://127.0.0.1:5173/asset/start.png
curl -I http://127.0.0.1:5173/asset/background.png
curl -I http://127.0.0.1:5173/asset/net.img.svg
curl -I "http://127.0.0.1:5173/asset/character/%ED%9E%88%EB%82%98%ED%83%80%EC%87%BC%EC%9A%94.png"
curl -I "http://127.0.0.1:5173/asset/sound/%EC%84%A0%ED%83%9D.mp3"
```

검색 검증:

```bash
grep -RniE "src/asset|\.\./asset|\./asset|['\"]asset/" src index.html \
  --exclude-dir=.git --exclude-dir=node_modules --exclude-dir=dist
```

브라우저 Network 기준:

* `/src/asset/...` 요청이 0개여야 한다.
* `/asset/start.png`, `/asset/background.png`, `/asset/net.img.svg`, `/asset/character/*`, `/asset/sound/*` 요청이 200이어야 한다.
* AudioContext autoplay 경고는 첫 사용자 입력 전 브라우저 정책일 수 있으므로 asset 404와 구분한다.

## 6. Codex 작업 시 주의사항

* 새 이미지/사운드를 참조할 때는 `assetPath(...)`를 사용한다.
* `src/index.html` 기준 상대경로를 만들지 않는다.
* `/src/asset/...` 요청이 하나라도 생기면 실패로 본다.
* `src/asset` symlink, `.DS_Store`, `dist`, `node_modules`는 커밋하지 않는다.
