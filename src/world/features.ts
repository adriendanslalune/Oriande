// Which kinds of places are put on the map. Strange places, monuments and wonders are taken off
// for now (asked by Adrien: they have no use yet); their generation, drawings and pictures stay,
// to be put back when the game needs them (clues about Oriande). Tests of their generation turn
// them on.
let placesOn = false;

/** Whether strange places, monuments and wonders are on the map. */
export const placesShown = (): boolean => placesOn;

/** Put them on the map (or take them off). */
export function showPlaces(on: boolean): void { placesOn = on; }
