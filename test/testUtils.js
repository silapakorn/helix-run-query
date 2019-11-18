/*
 * Copyright 2019 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

/* eslint-env mocha */

'use strict';

const assert = require('assert');
const {
  loadQuery, getHeaderParams, cleanHeaderParams, queryReplace, authFastly, replaceTableNames,
} = require('../src/util.js');
const env = require('../src/env.js');

describe('testing util functions', () => {
  const service = '0bxMEaYAJV6SoqFlbZ2n1f';

  it('loadQuery loads a query', async () => {
    const result = await loadQuery('next-resource');
    assert.ok(result.match(/select/i));
  });

  it('loadQuery throws with bad query file', async () => {
    const EXPECTED = new Error('Failed to load .sql file');
    const handle = () => loadQuery('Does not Exist');
    assert.rejects(handle, EXPECTED);
  });

  it('query parameters are processed', () => {
    const fakeQuery = '--- helix-param: helix\n--- helix-param2: helix2\n--- helix-param3: helix3\n# this query is intentionally broken.';
    const EXPECTED = { 'helix-param': 'helix', 'helix-param2': 'helix2', 'helix-param3': 'helix3' };
    const ACTUAL = getHeaderParams(fakeQuery);
    assert.deepEqual(EXPECTED, ACTUAL);
  });

  it('query parameters are cleaned from query', () => {
    const fakeQuery = `--- helix-param: helix\n--- helix-param2: helix2\n--- helix-param3: helix3\n#This is A random Comment\nSELECT req_url, count(req_http_X_CDN_Request_ID) AS visits, resp_http_Content_Type, status_code
    FROM ^tablename
    WHERE 
      resp_http_Content_Type LIKE "text/html%" AND
      status_code LIKE "404"
    GROUP BY
      req_url, resp_http_Content_Type, status_code 
    ORDER BY visits DESC
    LIMIT @limit`;

    const EXPECTED = 'SELECT req_url, count(req_http_X_CDN_Request_ID) AS visits, resp_http_Content_Type, status_code     FROM ^tablename     WHERE        resp_http_Content_Type LIKE "text/html%" AND       status_code LIKE "404"     GROUP BY       req_url, resp_http_Content_Type, status_code      ORDER BY visits DESC     LIMIT @limit';
    const ACTUAL = cleanHeaderParams(fakeQuery);
    assert.equal(EXPECTED, ACTUAL);
  });

  it('query substitution works', () => {
    const query = 'SELECT ^something1, ^something2 WHERE ^tablename';
    const EXPECTED = 'SELECT `Loves`, `CMS` WHERE `Helix`';

    const params = {
      tablename: 'Helix',
      something1: 'Loves',
      something2: 'CMS',
    };

    const ACTUAL = queryReplace(query, params);

    assert.equal(ACTUAL, EXPECTED);
  });

  it('prevents sql injection from canceling quotes and template strings', () => {
    const query = 'SELECT ^something1, ^something2 WHERE ^tablename';
    const EXPECTED = 'SELECT `Loves`, `CMS` WHERE `Helix`';

    const params = {
      tablename: '`Helix',
      something1: '\'Loves',
      something2: '"CMS',
      something3: 'foobar',
    };

    const ACTUAL = queryReplace(query, params);

    assert.equal(ACTUAL, EXPECTED);
  });

  it('prevents sql injection from malicious query', () => {
    const query = 'SELECT * FROM table WHERE ^maliciousCode';
    const EXPECTED = 'Only single phrase parameters allowed';
    const params = {
      maliciousCode: 'DROP TABLE table;',
    };
    assert.throws(() => (queryReplace(query, params)), new Error(EXPECTED));
  });

  it('authFastly correctly authenticates', async () => {
    const ret = await authFastly(env.token, service);
    assert.equal(true, ret);
  });

  it('authFastly rejects with bad token', async () => {
    const handle = async () => {
      await authFastly('bad token', service);
    };
    assert.rejects(handle);
  });

  it('authFastly rejects with bad serviceid', async () => {
    const handle = async () => {
      await authFastly(env.token, 'bad service');
    };
    assert.rejects(handle);
  });

  it('replaceTableName works', async () => {
    const result = await replaceTableNames('foo ^bar baz', { bar: () => 'bar' });

    assert.equal(result, 'foo bar baz');
  });

  it('replaceTableName works with promises', async () => {
    const result = await replaceTableNames('foo ^bar baz', { bar: () => Promise.resolve('bar') });

    assert.equal(result, 'foo bar baz');
  });

  it('replaceTableName works when not needed', async () => {
    const result = await replaceTableNames('foo bar baz', { bar: () => 'bar' });

    assert.equal(result, 'foo bar baz');
  });

  it('replaceTableName does not repeat', async () => {
    const result = await replaceTableNames('foo ^bar ^bar baz', {
      bar: () => 'bar',
    });

    assert.equal(result, 'foo bar bar baz');
  });
});
