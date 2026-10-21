import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createInventory, ITEMS } from '../src/models/inventory.js';

test('the satchel adds known items once, in order, and clears on reset', () => {
  const added = [];
  const bag = createInventory({ onAdd: id => added.push(id) });
  assert.equal(bag.add('lantern-sigil'), true);
  assert.equal(bag.add('lantern-sigil'), false);            // no duplicates, no second notice
  assert.equal(bag.add('tide-hook'), true);
  assert.deepEqual(bag.items.map(i => i.id), ['lantern-sigil', 'tide-hook']);
  assert.equal(bag.items[0].name, ITEMS['lantern-sigil'].name);
  assert.deepEqual(added, ['lantern-sigil', 'tide-hook']);
  assert.throws(() => bag.add('no-such-thing'), /Unknown item/);
  bag.reset();
  assert.equal(bag.has('tide-hook'), false);
  assert.equal(bag.items.length, 0);
});
