/**
 * Назначение файла: e2e-тест визуализации слоя адресов и регрессионного скриншота номеров домов.
 * Основные модули: express, @playwright/test.
 */
import { test, expect } from '@playwright/test';
import express from 'express';
import type { Server } from 'http';

const app = express();

const html = `<!DOCTYPE html>
<html lang="ru">
  <head>
    <meta charset="utf-8" />
    <title>Логистика — адреса</title>
    <style>
      body {
        margin: 0;
        font-family: 'Open Sans', 'Arial', sans-serif;
        background: #0b1c2c;
        display: flex;
        align-items: center;
        justify-content: center;
        height: 720px;
      }
      .map {
        width: 960px;
        height: 540px;
        border-radius: 28px;
        background: linear-gradient(135deg, #1e3a8a 0%, #0f172a 45%, #1e293b 100%);
        position: relative;
        overflow: hidden;
        box-shadow: 0 32px 80px rgba(15, 23, 42, 0.6);
      }
      .road {
        position: absolute;
        background: #475569;
        border-radius: 999px;
        box-shadow: inset 0 0 0 6px rgba(148, 163, 184, 0.28);
      }
      .road.horizontal {
        top: 45%;
        left: -10%;
        width: 120%;
        height: 64px;
        transform: rotate(-3deg);
      }
      .road.vertical {
        top: -10%;
        left: 46%;
        width: 72px;
        height: 130%;
        transform: rotate(8deg);
      }
      .block {
        position: absolute;
        width: 120px;
        height: 120px;
        border-radius: 20px;
        background: rgba(15, 118, 110, 0.82);
        box-shadow: inset 0 0 0 4px rgba(16, 185, 129, 0.45);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 48px;
        font-weight: 700;
        color: #f8fafc;
        text-shadow: 0 0 14px rgba(15, 23, 42, 0.85);
      }
      .block.small {
        width: 96px;
        height: 96px;
        border-radius: 18px;
        font-size: 36px;
      }
      .label {
        position: absolute;
        font-size: 20px;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        color: rgba(226, 232, 240, 0.85);
        text-shadow: 0 0 12px rgba(15, 23, 42, 0.75);
        font-weight: 600;
      }
      .label.district {
        top: 14%;
        left: 12%;
      }
      .label.avenue {
        bottom: 12%;
        right: 16%;
      }
    </style>
  </head>
  <body>
    <div class="map" id="map">
      <div class="road horizontal"></div>
      <div class="road vertical"></div>
      <div class="block" style="top: 24%; left: 30%; transform: rotate(-6deg);">12</div>
      <div class="block small" style="top: 26%; left: 52%; transform: rotate(3deg);">14</div>
      <div class="block" style="top: 56%; left: 24%; transform: rotate(4deg);">16</div>
      <div class="block small" style="top: 58%; left: 48%; transform: rotate(-2deg);">18</div>
      <div class="block" style="top: 34%; left: 68%; transform: rotate(-8deg);">20</div>
      <div class="label district">ПОДОЛЬСКИЙ РАЙОН</div>
      <div class="label avenue">ПРОСП. СВОБОДЫ</div>
    </div>
  </body>
</html>`;

app.get('/', (_req, res) => {
  res.type('html').send(html);
});

let server: Server;

const port = 4321;

test.beforeAll(async () => {
  await new Promise<void>((resolve) => {
    server = app.listen(port, () => resolve());
  });
});

test.afterAll(async () => {
  await new Promise<void>((resolve) => {
    server.close(() => resolve());
  });
});

test.describe('Логистика: визуальный слой адресов', () => {
  test('текстовый снимок фиксирует номера домов и порядок слоёв', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'Снимок сравниваем только в Chromium для стабильности.');

    await page.goto(`http://127.0.0.1:${port}/`);
    await page.waitForTimeout(200);

    const summary = await page.locator('#map').evaluate(() => {
      const map = document.getElementById('map');
      if (!map) {
        return null;
      }
      const computed = window.getComputedStyle(map);
      const items = Array.from(map.children).map((node) => {
        const element = node as HTMLElement;
        const styles = window.getComputedStyle(element);
        return {
          tag: element.tagName.toLowerCase(),
          className: element.className,
          zIndex: styles.zIndex,
        };
      });
      const blocks = Array.from(
        map.querySelectorAll<HTMLElement>('.block, .block.small'),
      ).map((element) => {
        const styles = window.getComputedStyle(element);
        return {
          text: element.textContent?.trim() ?? '',
          fontSize: styles.fontSize,
          color: styles.color,
          textShadow: styles.textShadow,
        };
      });
      const labels = Array.from(map.querySelectorAll<HTMLElement>('.label')).map(
        (element) => {
          const styles = window.getComputedStyle(element);
          return {
            text: element.textContent?.trim() ?? '',
            fontSize: styles.fontSize,
            color: styles.color,
            zIndex: styles.zIndex,
          };
        },
      );
      return {
        map: {
          background: computed.backgroundImage || computed.backgroundColor,
          size: `${computed.width}×${computed.height}`,
        },
        items,
        blocks,
        labels,
      };
    });

    expect(summary).not.toBeNull();
    expect(summary?.blocks.map((entry) => entry.text)).toEqual(['12', '14', '16', '18', '20']);
    const firstRoadIndex = summary?.items.findIndex((entry) => entry.className.includes('road')) ?? -1;
    const firstBlockIndex = summary?.items.findIndex((entry) => entry.className.includes('block')) ?? -1;
    const firstLabelIndex = summary?.items.findIndex((entry) => entry.className.includes('label')) ?? -1;

    expect(firstRoadIndex).toBeGreaterThanOrEqual(0);
    expect(firstBlockIndex).toBeGreaterThanOrEqual(0);
    expect(firstLabelIndex).toBeGreaterThanOrEqual(0);
    expect(firstRoadIndex).toBeLessThan(firstBlockIndex);
    expect(firstBlockIndex).toBeLessThan(firstLabelIndex);

    await expect(JSON.stringify(summary, null, 2)).toMatchSnapshot('logistics-addresses.txt');
  });
});
