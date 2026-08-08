import { expect, type Locator, type Page } from "@playwright/test";

async function handleCenter(
  handle: Locator,
): Promise<{ x: number; y: number }> {
  await handle.scrollIntoViewIfNeeded();
  const box = await handle.boundingBox();
  expect(box, "The drag handle must have a rendered box").not.toBeNull();
  return { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 };
}

export async function dragWithMouse(
  page: Page,
  source: Locator,
  target: Locator,
) {
  const start = await handleCenter(source);
  const end = await handleCenter(target);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 12 });
  await page.mouse.up();
}

export async function dragWithChromiumTouch(
  page: Page,
  source: Locator,
  target: Locator,
) {
  const start = await handleCenter(source);
  const end = await handleCenter(target);
  const session = await page.context().newCDPSession(page);

  try {
    await session.send("Emulation.setTouchEmulationEnabled", {
      enabled: true,
      maxTouchPoints: 1,
    });
    await session.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ ...start, force: 1, id: 0, radiusX: 4, radiusY: 4 }],
    });
    await page.waitForTimeout(300);
    for (let step = 1; step <= 12; step += 1) {
      await session.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [
          {
            force: 1,
            id: 0,
            radiusX: 4,
            radiusY: 4,
            x: start.x + ((end.x - start.x) * step) / 12,
            y: start.y + ((end.y - start.y) * step) / 12,
          },
        ],
      });
      await page.waitForTimeout(16);
    }
    await page.waitForTimeout(50);
    await session.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
  } finally {
    await session.detach();
  }
}

export async function dragWithWebKitTouch(
  page: Page,
  source: Locator,
  target: Locator,
) {
  const start = await handleCenter(source);
  const end = await handleCenter(target);
  await source.dispatchEvent("pointerdown", {
    bubbles: true,
    button: 0,
    buttons: 1,
    clientX: start.x,
    clientY: start.y,
    isPrimary: true,
    pointerId: 1,
    pointerType: "touch",
    pressure: 0.5,
  });
  await page.waitForTimeout(300);

  for (let step = 1; step <= 12; step += 1) {
    await page.evaluate(
      ({ x, y }) => {
        document.dispatchEvent(
          new PointerEvent("pointermove", {
            bubbles: true,
            buttons: 1,
            clientX: x,
            clientY: y,
            isPrimary: true,
            pointerId: 1,
            pointerType: "touch",
            pressure: 0.5,
          }),
        );
      },
      {
        x: start.x + ((end.x - start.x) * step) / 12,
        y: start.y + ((end.y - start.y) * step) / 12,
      },
    );
    await page.waitForTimeout(16);
  }

  await page.evaluate(({ x, y }) => {
    document.dispatchEvent(
      new PointerEvent("pointerup", {
        bubbles: true,
        button: 0,
        buttons: 0,
        clientX: x,
        clientY: y,
        isPrimary: true,
        pointerId: 1,
        pointerType: "touch",
        pressure: 0,
      }),
    );
  }, end);
}
