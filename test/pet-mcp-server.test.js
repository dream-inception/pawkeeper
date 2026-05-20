const assert = require('node:assert/strict');
const test = require('node:test');

const {
  createMcpConfigSnippet,
  getConfiguredLocalDomain,
  getLocalMdnsHostName,
} = require('../src/main/pet-mcp-server');

test('builds stable local mDNS host names', () => {
  assert.equal(getLocalMdnsHostName('MacBook-Pro'), 'MacBook-Pro.local');
  assert.equal(getLocalMdnsHostName('MacBook Pro.local'), 'MacBook-Pro.local');
  assert.equal(getLocalMdnsHostName('张三的 MacBook'), 'MacBook.local');
  assert.equal(getLocalMdnsHostName(''), 'break-neko.local');
});

test('uses custom local domain before host fallback', () => {
  assert.equal(getConfiguredLocalDomain({
    pet: { mcpLocalDomain: 'neko.local' },
  }), 'neko.local');
  assert.match(getConfiguredLocalDomain({
    pet: { mcpLocalDomain: '' },
  }), /\.local$/);
});

test('builds Cursor MCP config snippets with bearer auth', () => {
  assert.deepEqual(JSON.parse(createMcpConfigSnippet('http://neko.local:8765/mcp', 'token-123')), {
    mcpServers: {
      'break-neko-pet': {
        url: 'http://neko.local:8765/mcp',
        headers: {
          Authorization: 'Bearer token-123',
        },
      },
    },
  });
});
