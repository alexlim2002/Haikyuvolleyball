import { swapKeyVal } from "../utils/swapKeyVal.js";
import { Enum } from "../utils/Enum.js";
import { TripleBufferStatic } from "./TripleBuffer.js";

export const InputType = Enum(
  "1P_UP",
  "1P_DOWN",
  "1P_LEFT",
  "1P_RIGHT",

  "2P_UP",
  "2P_DOWN",
  "2P_LEFT",
  "2P_RIGHT",
);

function mappingFnFrom(mapping) {
  const map = Object.freeze(swapKeyVal(mapping));
  return (code) => InputType[map[code]];
}

/**
 * initInputSystem({ keyboardMapping, touchMapping })
 *
 * - InputType 기준으로 TripleBufferStatic을 만들고 이벤트로 갱신
 * - 매 틱 next()를 호출하면 그 순간의 스냅샷을 yield하는
 *   async generator 함수를 반환
 *
 * @returns {() => AsyncGenerator<{ [inputType: string]: boolean }>}
 */
export function initInputSystem({ keyboardMapping, touchMapping }) {
  const fromKeyboard = mappingFnFrom(keyboardMapping);
  // TODO: const fromTouch = mappingFnFrom(touchMapping);

  const emptyTable = () =>
    Object.fromEntries(Object.keys(InputType).map((k) => [k, false]));

  const stateTable = new TripleBufferStatic(emptyTable);

  window.addEventListener("keydown", (e) => {
    const input = fromKeyboard(e.code);
    if (input !== undefined) {
      stateTable[input] = true;
    }
  });

  window.addEventListener("keyup", (e) => {
    const input = fromKeyboard(e.code);
    if (input !== undefined) {
      stateTable[input] = false;
    }
  });

  async function* inputsOfThisTick() {
    while (true) {
      yield stateTable.buff;
    }
  }

  return inputsOfThisTick;
}
