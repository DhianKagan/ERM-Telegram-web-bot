/** @jest-environment jsdom */
// Тесты ThemeProvider: проверка токенов и cookie
// Модули: React Testing Library, ThemeProvider
import { cleanup, render, waitFor, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import presets from '../theme/presets.json';
import { ThemeProvider } from './ThemeProvider';
import { useTheme } from './useTheme';

jest.mock('next-themes', () => ({
  ThemeProvider: ({ children }: { children?: unknown }) => <>{children}</>,
}));

type ThemeValue = ReturnType<typeof useTheme>;

describe('ThemeProvider', () => {
  beforeEach(() => {
    cleanup();
    document.cookie = 'theme=;path=/;max-age=0';
    document.cookie = 'theme-tokens=;path=/;max-age=0';
    document.documentElement.className = '';
    document.documentElement.style.cssText = '';
  });

  function readCookie(name: string) {
    const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
    return match ? decodeURIComponent(match[1]) : null;
  }

  it('сбрасывает повреждённый cookie токенов к пресету', async () => {
    document.cookie = 'theme=dark;path=/';
    document.cookie = 'theme-tokens=not-json;path=/';

    render(
      <ThemeProvider>
        <div />
      </ThemeProvider>,
    );

    await waitFor(() =>
      expect(
        document.documentElement.style.getPropertyValue('--background'),
      ).toBe(presets.dark.background),
    );

    const saved = readCookie('theme-tokens');
    expect(saved).not.toBe('not-json');
    expect(saved).not.toBeNull();
    const parsed = JSON.parse(saved!);
    expect(parsed.theme).toBe('dark');
    expect(parsed.tokens).toMatchObject(presets.dark);
  });

  it('меняет тему, обновляя CSS и cookie', async () => {
    let captured: ThemeValue | null = null;
    function Capture({ children }: { children?: ReactNode }) {
      captured = useTheme();
      return <>{children}</>;
    }

    render(
      <ThemeProvider>
        <Capture />
      </ThemeProvider>,
    );

    await waitFor(() =>
      expect(
        document.documentElement.style.getPropertyValue('--background'),
      ).toBe(presets.light.background),
    );

    await act(async () => {
      captured?.setTheme('dark');
    });

    await waitFor(() =>
      expect(document.documentElement.classList.contains('dark')).toBe(true),
    );
    expect(
      document.documentElement.style.getPropertyValue('--background'),
    ).toBe(presets.dark.background);

    expect(readCookie('theme')).toBe('dark');
    const saved = readCookie('theme-tokens');
    expect(saved).not.toBeNull();
    const parsed = JSON.parse(saved!);
    expect(parsed.theme).toBe('dark');
    expect(parsed.tokens).toMatchObject(presets.dark);
  });
});
