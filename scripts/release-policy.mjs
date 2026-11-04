import assert from "node:assert/strict";
import { URL } from "node:url";

function csdiUrl(value) {
  const url = new URL(value);
  assert.equal(url.protocol, "https:");
  assert.equal(url.hostname, "portal.csdi.gov.hk");
  assert.equal(url.port, "");
  assert.equal(url.username, "");
  assert.equal(url.password, "");
  return url;
}

export function validateDatasetUrl(value) {
  csdiUrl(value);
}

export function validateAttributionTerms(attribution) {
  const terms = attribution
    .split(/\r?\n/)
    .filter((line) => line.startsWith("Terms:"));
  assert.equal(terms.length, 1, "Expected one Terms: URL");
  const url = csdiUrl(terms[0].slice("Terms:".length).trim());
  assert.equal(url.pathname, "/csdi-webpage/doc/TNC");
  assert.equal(url.search, "");
  assert.equal(url.hash, "");
}
