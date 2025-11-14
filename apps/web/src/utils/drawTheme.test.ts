/* eslint-disable @typescript-eslint/no-require-imports */
/** @jest-environment jsdom */
// Назначение: smoke-тест темы рисования для MapLibre
// Основные модули: Jest, mapLibrary, customTheme

import '@testing-library/jest-dom';
import type { Map as MapConstructor } from 'maplibre-gl';

const buildMapMock = () => ({
  addControl: jest.fn(),
  on: jest.fn(),
  off: jest.fn(),
  remove: jest.fn(),
});

jest.mock('maplibre-gl/dist/maplibre-gl.css', () => ({}), { virtual: true });
jest.mock('pmtiles', () => ({
  Protocol: jest.fn(() => ({ tile: jest.fn() })),
}));

jest.mock(
  'maplibre-gl',
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

const drawMock = jest.fn(
  (options?: { styles?: Array<{ paint?: Record<string, unknown> }> }) => {
    if (!options?.styles) {
      throw new Error('styles обязательны для кастомной темы');
    }
    for (const style of options.styles) {
      const paint = style?.paint as Record<string, unknown> | undefined;
      const dashArray = paint?.['line-dasharray'];
      if (
        Array.isArray(dashArray) &&
        dashArray.some((entry) => Array.isArray(entry))
      ) {
        throw new Error('line-dasharray должен быть массивом чисел');
      }
    }
    return {};
  },
);

jest.mock('maplibre-gl-draw', () => drawMock, { virtual: true });

describe('customTheme', () => {
  it('рендерится без ошибок line-dasharray', () => {
    const { customTheme } = require('./drawTheme');
    const mapLibrary = require('./mapLibrary').default as {
      Map: MapConstructor;
    };

    const container = document.createElement('div');
    new mapLibrary.Map({ container });
    const Draw = require('maplibre-gl-draw') as jest.Mock;
    new Draw({ styles: customTheme });

    const lineLayers = customTheme.filter(
      (
        style,
      ): style is {
        id: string;
        type: 'line';
        paint?: Record<string, unknown>;
      } => style.type === 'line',
    );

    expect(lineLayers).toHaveLength(2);
    for (const layer of lineLayers) {
      const dashArray = layer.paint?.['line-dasharray'];
      expect(Array.isArray(dashArray)).toBe(true);
      expect(
        (dashArray as unknown[]).every((value) => typeof value === 'number'),
      ).toBe(true);
    }

    expect(Draw).toHaveBeenCalledWith(
      expect.objectContaining({ styles: expect.any(Array) }),
    );
  });
});
