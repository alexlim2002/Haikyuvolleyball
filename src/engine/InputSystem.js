import { swapKeyVal } from "../utils/swapKeyVal.js";
import { Enum } from "../utils/Enum.js";

export const InputType = Enum(
  "1P_UP",
  "1P_DOWN",
  "1P_LEFT",
  "1P_RIGHT",
  "1P_ACTION",
  "1P_CONFIRM",
  "1P_DOUBLE_UP",
  "1P_DOUBLE_DOWN",
  "1P_DOUBLE_LEFT",
  "1P_DOUBLE_RIGHT",

  "2P_UP",
  "2P_DOWN",
  "2P_LEFT",
  "2P_RIGHT",
  "2P_ACTION",
  "2P_CONFIRM",
  "2P_DOUBLE_UP",
  "2P_DOUBLE_DOWN",
  "2P_DOUBLE_LEFT",
  "2P_DOUBLE_RIGHT",
);

const DOUBLE_TAP_MS = 500;

function mappingFnFrom(mapping) {
  const map = Object.freeze(swapKeyVal(mapping));
  return (code) => InputType[map[code]];
}

function toDoubleInput(input) {
  switch (input) {
    case InputType["1P_UP"]:
      return InputType["1P_DOUBLE_UP"];
    case InputType["1P_DOWN"]:
      return InputType["1P_DOUBLE_DOWN"];
    case InputType["1P_LEFT"]:
      return InputType["1P_DOUBLE_LEFT"];
    case InputType["1P_RIGHT"]:
      return InputType["1P_DOUBLE_RIGHT"];
    case InputType["2P_UP"]:
      return InputType["2P_DOUBLE_UP"];
    case InputType["2P_DOWN"]:
      return InputType["2P_DOUBLE_DOWN"];
    case InputType["2P_LEFT"]:
      return InputType["2P_DOUBLE_LEFT"];
    case InputType["2P_RIGHT"]:
      return InputType["2P_DOUBLE_RIGHT"];
    default:
      return undefined;
  }
}

/**
 * initInputSystem({ keyboardMapping, touchMapping })
 *
 * - InputType 기준으로 TripleBufferStatic을 만들고 이벤트로 갱신
 * - 매 틱 next()를 호출하면 그 순간의 스냅샷을 yield하는
 *   async generator 함수를 반환
 * - DOUBLE_* 입력은 감지된 틱 하나만 true, yield 직후 초기화
 *
 * @returns {() => AsyncGenerator<{ [inputType: string]: boolean }>}
 */
export function initInputSystem({ keyboardMapping, touchMapping }) {
  const fromKeyboard = mappingFnFrom(keyboardMapping);
  // TODO: const fromTouch = mappingFnFrom(touchMapping);

  const emptyTable = () =>
    Object.fromEntries(Object.keys(InputType).map((k) => [k, false]));

  const stateTable = emptyTable();
  const doubleInputs = Object.keys(InputType).filter((k) =>
    k.includes("_DOUBLE_"),
  );

  let double = { input: null, time: -Infinity, phase: 0 };

  window.addEventListener("keydown", (e) => {
    let input = fromKeyboard(e.code);
    if (fromKeyboard("ShiftRight") && e.keyCode === 16 && e.location === 0) {
      input = fromKeyboard("ShiftRight");
    }
    if (input === undefined) {
      return;
    }

    const now = performance.now();
    const doubleInput = toDoubleInput(input);
    if (doubleInput && input === double.input && double.phase === 1) {
      if (now - double.time < DOUBLE_TAP_MS) {
        stateTable[doubleInput] = true;
      }
      double = { input: null, time: -Infinity, phase: 0 };
    } else {
      stateTable[input] = true;
      double.input = input;
      double.time = now;
      double.phase = 0;
    }
  });

  window.addEventListener("keyup", (e) => {
    let input = fromKeyboard(e.code);
    if (fromKeyboard("ShiftRight") && e.keyCode === 16 && e.location === 0) {
      input = fromKeyboard("ShiftRight");
    }
    if (input === undefined) return;
    stateTable[input] = false;
    if (input === double.input) double.phase = 1;
  });

  function* inputsOfThisTick() {
    while (true) {
      let ret = { ...stateTable };
      doubleInputs.forEach((k) => {
        stateTable[k] = false;
      });
      yield ret;
    }
  }

  return inputsOfThisTick;
}
