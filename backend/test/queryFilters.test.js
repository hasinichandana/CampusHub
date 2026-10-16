const assert = require('node:assert/strict');
const test = require('node:test');
const { addTextSearch, parsePagination } = require('../utils/queryFilters');

test('adds text search without replacing role-scope OR conditions', () => {
  const query = {
    $or: [
      { assignedTo: 'faculty-1' },
      { departmentId: 'department-1' }
    ]
  };

  assert.equal(addTextSearch(query, 'water', ['title', 'description']), null);
  assert.equal(query.$or, undefined);
  assert.equal(query.$and.length, 2);
  assert.deepEqual(query.$and[0], {
    $or: [
      { assignedTo: 'faculty-1' },
      { departmentId: 'department-1' }
    ]
  });
  assert.deepEqual(query.$and[1], {
    $or: [
      { title: { $regex: 'water', $options: 'i' } },
      { description: { $regex: 'water', $options: 'i' } }
    ]
  });
});

test('preserves existing audience and expiry conditions when searching', () => {
  const audienceCondition = { audience: 'College' };
  const expiryCondition = { expiresAt: { $gt: new Date('2026-10-01') } };
  const query = {
    $or: [{ status: 'Published' }, { createdBy: 'faculty-1' }],
    $and: [audienceCondition, expiryCondition]
  };

  assert.equal(addTextSearch(query, 'exam', ['title', 'content']), null);
  assert.deepEqual(query.$and, [
    audienceCondition,
    expiryCondition,
    { $or: [{ status: 'Published' }, { createdBy: 'faculty-1' }] },
    {
      $or: [
        { title: { $regex: 'exam', $options: 'i' } },
        { content: { $regex: 'exam', $options: 'i' } }
      ]
    }
  ]);
});

test('treats search input literally and rejects query objects and overlong terms', () => {
  const query = {};
  assert.equal(addTextSearch(query, '.*', ['title']), null);
  assert.equal(query.$and[0].$or[0].title.$regex, '\\.\\*');

  const unchangedQuery = {};
  assert.match(addTextSearch(unchangedQuery, { $ne: '' }, ['title']), /must be a string/);
  assert.match(addTextSearch(unchangedQuery, 'x'.repeat(101), ['title']), /100 characters/);
  assert.deepEqual(unchangedQuery, {});
});

test('validates pagination and enforces a bounded page size', () => {
  assert.deepEqual(parsePagination(undefined, undefined), {
    page: 1,
    limit: 10,
    skip: 0
  });
  assert.deepEqual(parsePagination('3', '25'), {
    page: 3,
    limit: 25,
    skip: 50
  });

  for (const invalid of [
    [{ $gt: 0 }, '10'],
    ['-1', '10'],
    ['0', '10'],
    ['1', '101'],
    ['1.5', '10'],
    ['9007199254740992', '10']
  ]) {
    assert.equal(parsePagination(invalid[0], invalid[1]), null);
  }
});
