import { readFileSync } from "node:fs";
import { URL } from "node:url";
import { expect, test } from "vitest";
import {
  validateAttributionTerms,
  validateDatasetUrl,
} from "../scripts/release-policy.mjs";

const termsUrl = "https://portal.csdi.gov.hk/csdi-webpage/doc/TNC";

test("current attribution and dataset URL pass the release policy", () => {
  validateAttributionTerms(
    readFileSync(
      new URL("../public/DATA-ATTRIBUTION.txt", import.meta.url),
      "utf8",
    ),
  );
  validateDatasetUrl(
    "https://portal.csdi.gov.hk/csdi-webpage/dataset/landsd_rcd_1742809441342_98380",
  );
});

test.each([
  `https://evil.example/?url=${termsUrl}`,
  `https://evil.example/${termsUrl}`,
  "https://portal.csdi.gov.hk.evil.example/csdi-webpage/doc/TNC",
  "https://portal.csdi.gov.hk@evil.example/csdi-webpage/doc/TNC",
  "http://portal.csdi.gov.hk/csdi-webpage/doc/TNC",
  "https://portal.csdi.gov.hk:8443/csdi-webpage/doc/TNC",
  "https://user@portal.csdi.gov.hk/csdi-webpage/doc/TNC",
  `${termsUrl}-fake`,
  `${termsUrl}?redirect=https://evil.example`,
  `${termsUrl}#fake`,
  "not a URL",
])("rejects a misleading terms URL: %s", (value) => {
  expect(() => validateAttributionTerms(`Terms: ${value}`)).toThrow();
});

test("an unrelated copy of the correct URL cannot replace the Terms line", () => {
  expect(() =>
    validateAttributionTerms(
      `Reference: ${termsUrl}\nTerms: https://evil.example/`,
    ),
  ).toThrow();
  expect(() => validateAttributionTerms(`Reference: ${termsUrl}`)).toThrow();
  expect(() =>
    validateAttributionTerms(`Terms: ${termsUrl}\nTerms: ${termsUrl}`),
  ).toThrow();
});

test.each([
  "https://portal.csdi.gov.hk.evil.example/dataset",
  "https://portal.csdi.gov.hk@evil.example/dataset",
  "https://evil.example/?url=https://portal.csdi.gov.hk/",
  "http://portal.csdi.gov.hk/dataset",
])("rejects a misleading dataset URL: %s", (value) => {
  expect(() => validateDatasetUrl(value)).toThrow();
});
