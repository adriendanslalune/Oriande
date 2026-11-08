// Tests run at a fixed moment of the shared world clock: a clear noon at the start of the game,
// so that weather and night never make a test depend on when it runs.
import { freezeTime } from './world/weather';

freezeTime(1_800_003_686.4);
