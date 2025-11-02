/** @jest-environment jsdom */
// Назначение: smoke-тест темы рисования при MapLibre fallback
// Основные модули: Jest, mapLibrary, customTheme

import "@testing-library/jest-dom";
import type { Map as MapConstructor } from "mapbox-gl";

jest.mock("../config/map", () => {
  const actual = jest.requireActual("../config/map");
  return {
    ...actual,
    MAP_STYLE_FALLBACK_USED: true,
  };
});

jest.mock("mapbox-gl/dist/mapbox-gl.css", () => ({}), { virtual: true });
jest.mock("maplibre-gl/dist/maplibre-gl.css", () => ({}), { virtual: true });

const buildMapMock = () => ({
  addControl: jest.fn(),
  on: jest.fn(),
  off: jest.fn(),
  remove: jest.fn(),
});

jest.mock(
  "mapbox-gl",
  () => {
    const Map = jest.fn(() => buildMapMock());
    return {
      __esModule: true,
      default: { Map },
      Map,
    } satisfies { default: { Map: MapConstructor }; Map: MapConstructor };
  },
  { virtual: true },
);

jest.mock(
  "maplibre-gl",
  () => jest.requireMock("mapbox-gl"),
  { virtual: true },
);

const mapboxDrawMock = jest.fn(
  (options?: { styles?: Array<{ paint?: Record<string, unknown> }> }) => {
    if (!options?.styles) {
      console.error(
        "line-dasharray выражение должно использовать literal для совместимости с MapLibre.",
      );
      return {};
    }
    for (const style of options.styles) {
      const paint = style?.paint as Record<string, unknown> | undefined;
      const dashArray = paint?.["line-dasharray"];
      if (
        Array.isArray(dashArray) &&
        dashArray.some(
          (entry) => Array.isArray(entry) && entry.length > 0 && typeof entry[0] === "number",
        )
      ) {
        console.error(
          "line-dasharray выражение должно использовать literal для совместимости с MapLibre.",
        );
        break;
      }
    }
    return {};
  },
);

jest.mock(
  "@mapbox/mapbox-gl-draw",
  () => mapboxDrawMock,
  { virtual: true },
);

describe("customTheme", () => {
  it("поддерживает MapLibre без ошибок line-dasharray", () => {
    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const { customTheme } = require("./drawTheme");
    const mapLibrary = require("./mapLibrary").default as { Map: MapConstructor };

    const container = document.createElement("div");
    new mapLibrary.Map({ container });
    const Draw = require("@mapbox/mapbox-gl-draw") as jest.Mock;
    new Draw({ styles: customTheme });

    const lineLayers = customTheme.filter(
      (style): style is { id: string; type: "line"; paint?: Record<string, unknown> } =>
        style.type === "line",
    );

    expect(lineLayers.map((layer) => layer.id)).toEqual(
      expect.arrayContaining(["gl-draw-lines-inactive", "gl-draw-lines-active"]),
    );
    expect(lineLayers).toHaveLength(2);
    for (const layer of lineLayers) {
      const dashArray = layer.paint?.["line-dasharray"];
      expect(Array.isArray(dashArray)).toBe(true);
      expect((dashArray as unknown[]).every((value) => typeof value === "number")).toBe(true);
    }

    expect(Draw).toHaveBeenCalledWith(
      expect.objectContaining({ styles: expect.any(Array) }),
    );
    expect(consoleErrorSpy).not.toHaveBeenCalledWith(
      expect.stringContaining("line-dasharray"),
    );
    consoleErrorSpy.mockRestore();
  });
});
