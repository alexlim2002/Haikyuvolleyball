/**
 * initAssetStore(assetDescription, decode)
 *
 * assetDescription : { [name]: url }
 * decode           : SoundEngine.decode — arrayBuffer → AudioBuffer 변환 함수
 *
 * 파일명 규칙으로 타입/프레임 크기를 결정:
 *   name.img.png      → ImageBitmap
 *   name.imgN.png     → 정사각형 N px로 나눈 스프라이트 배열
 *                        asset[name][i] = { image, sx, sy, sw, sh }
 *   name.sound.ext    → AudioBuffer
 *
 * @returns {Promise<Readonly<{ [name]: ImageBitmap | SpriteFrame[] | AudioBuffer }>>}
 */
export async function initAssetStore(assetDescription, decode) {
  const entries = await Promise.all(
    Object.entries(assetDescription).map(([name, url]) =>
      loadAsset(name, url, decode)
    )
  );
  return Object.freeze(Object.fromEntries(entries));
}

async function loadAsset(name, url, decode) {
  const filename = url.split("/").pop();

  const spriteMatch = filename.match(/\.img(\d+)\./);
  if (spriteMatch) {
    const size = Number(spriteMatch[1]);
    return [name, await loadSprite(url, size)];
  }

  if (filename.includes(".img.")) {
    return [name, await loadImage(url)];
  }

  if (filename.includes(".sound.")) {
    return [name, await loadSound(url, decode)];
  }

  throw new Error(`[AssetStore] 알 수 없는 에셋 타입: ${url}`);
}

async function loadImage(url) {
  const res = await fetch(url);
  const blob = await res.blob();
  return createImageBitmap(blob);
}

async function loadSprite(url, size) {
  const image = await loadImage(url);
  const cols = Math.floor(image.width  / size);
  const rows = Math.floor(image.height / size);
  const frames = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      frames.push(Object.freeze({ image, sx: col * size, sy: row * size, sw: size, sh: size }));
    }
  }
  return Object.freeze(frames);
}

async function loadSound(url, decode) {
  const res = await fetch(url);
  const arrayBuffer = await res.arrayBuffer();
  return decode(arrayBuffer);
}
