/** Cities with a loaded water network, and where the map opens for each. */
export const CITY_CENTRES: Record<string, [number, number]> = {
  Coimbra: [-8.4195, 40.2033],
  Toulouse: [1.4442, 43.6047],
  Benevento: [14.7826, 41.1299],
  Gent: [3.7174, 51.0543],
  Oslo: [10.7522, 59.9139],
  Tashkent: [69.2401, 41.2995],
};

export const CITIES = Object.keys(CITY_CENTRES);
export const DEFAULT_CITY = "Coimbra";
