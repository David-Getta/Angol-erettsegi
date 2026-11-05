import { test, expect } from "@playwright/test";

/** Every page renders (200, a heading) without console errors such as hydration mismatches. */
const ROUTES = [
  "/",
  "/szintfelmero",
  "/olvasas",
  "/nyelvhelyesseg",
  "/nyelvhelyesseg/celzott",
  "/hallas",
  "/iras",
  "/szobeli",
  "/szokincs",
  "/szokincs/ismetles",
  "/hibanaplo",
  "/hibanaplo/ujraproba",
  "/szabalytar",
  "/szabalytar/tense",
  "/kifejezesek",
  "/temakorok",
  "/temakorok/kornyezet",
  "/probaerettsegi",
  "/vizsga",
  "/hivatalos",
  "/statisztika",
  "/parancsok",
  "/beallitasok",
  "/olvasas/rd-emelt-digital-detox-camps-mc",
  "/nyelvhelyesseg/lu-emelt-urban-beekeeping-open-cloze",
  "/hallas/ls-kozep-city-bike-scheme-tf",
  "/iras/wr-emelt-gap-year-forum",
  "/szobeli/sp-emelt-eletmod-interview",
];

for (const route of ROUTES) {
  test(`page renders: ${route}`, async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "error" && !/Download the React DevTools|favicon/.test(m.text())) errors.push(m.text());
    });
    page.on("pageerror", (e) => errors.push(e.message));
    const res = await page.goto(route, { waitUntil: "networkidle" });
    expect(res?.status(), route).toBe(200);
    await expect(page.locator("h1").first()).toBeVisible();
    expect(errors, errors.join("\n")).toEqual([]);
  });
}
