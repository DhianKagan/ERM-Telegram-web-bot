import { validateCoords } from '../src/services/route';

describe('validateCoords', () => {
  it('accepts semicolon-separated coordinate pairs', () => {
    expect(validateCoords('30,50;31,51')).toBe('30,50;31,51');
  });

  it('accepts pipe-separated coordinate pairs', () => {
    expect(validateCoords('30,50|31,51')).toBe('30,50|31,51');
  });

  it('rejects invalid coordinate strings', () => {
    expect(() => validateCoords('30,50|invalid')).toThrow(
      'Некорректные координаты',
    );
  });
});
