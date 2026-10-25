import test from "node:test";
import assert from "node:assert/strict";
import { lookFromSeed, normalizeLook, randomLook } from "../src/lib/avatar-look";

test("a traveler without a chosen avatar always gets the same one", () => {
  assert.deepEqual(lookFromSeed("traveler-1"), lookFromSeed("traveler-1"));
  assert.notDeepEqual(lookFromSeed("traveler-1"), lookFromSeed("traveler-2"));
});

test("beards belong to boys and earrings to girls", () => {
  for (let index = 0; index < 200; index += 1) {
    const boy = randomLook("boy");
    const girl = randomLook("girl");
    assert.equal(boy.earrings, false);
    assert.equal(girl.beard, false);
    assert.equal(boy.gender, "boy");
    assert.equal(girl.gender, "girl");
  }
});

test("only valid looks are accepted from a browser", () => {
  const look = randomLook("girl");
  assert.deepEqual(normalizeLook(look), look);
  assert.equal(normalizeLook({ ...look, skin: 99 }), null);
  assert.equal(normalizeLook({ ...look, gender: "robot" }), null);
  assert.equal(normalizeLook({ ...look, glasses: "yes" }), null);
  assert.equal(normalizeLook(null), null);
  assert.equal(normalizeLook({ ...look, gender: "boy", earrings: true })?.earrings, false);
});
