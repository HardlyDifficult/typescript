/**
 * Indicator framework - auto-registers all built-in indicators on import.
 */

export type { Indicator } from "./types.js";
export { registerIndicator, getIndicator, getAvailableIndicators } from "./registry.js";

import { smaIndicator } from "./sma.js";
import { emaIndicator } from "./ema.js";
import { rsiIndicator } from "./rsi.js";
import { macdIndicator, macdSignalIndicator } from "./macd.js";
import { bollingerIndicator } from "./bollinger.js";
import { rocIndicator } from "./roc.js";
import { atrIndicator } from "./atr.js";
import { stochIndicator } from "./stoch.js";
import { obvIndicator } from "./obv.js";

import { registerIndicator } from "./registry.js";

registerIndicator(smaIndicator);
registerIndicator(emaIndicator);
registerIndicator(rsiIndicator);
registerIndicator(macdIndicator);
registerIndicator(macdSignalIndicator);
registerIndicator(bollingerIndicator);
registerIndicator(rocIndicator);
registerIndicator(atrIndicator);
registerIndicator(stochIndicator);
registerIndicator(obvIndicator);

// Re-export individual indicators for direct access
export { smaIndicator } from "./sma.js";
export { emaIndicator } from "./ema.js";
export { rsiIndicator } from "./rsi.js";
export { macdIndicator, macdSignalIndicator } from "./macd.js";
export { bollingerIndicator } from "./bollinger.js";
export { rocIndicator } from "./roc.js";
export { atrIndicator } from "./atr.js";
export { stochIndicator } from "./stoch.js";
export { obvIndicator } from "./obv.js";
