const crypto = require('node:crypto');
const http = require('node:http');
const os = require('node:os');
const { Bonjour } = require('bonjour-service');

const DEFAULT_HOST = '127.0.0.1';
const LAN_HOST = '0.0.0.0';
const DEFAULT_PORT = 8765;
const MCP_PATH = '/mcp';
const STATE_PATH = '/state';
const HEALTH_PATH = '/health';
const MDNS_SERVICE_NAME = 'Pawkeeper Pet';
const MDNS_SERVICE_TYPE = 'mcp';

function createPetMcpServerController({
  getSettings,
  getToken,
  setToken,
  petController,
  saveSettings,
  logger = console,
}) {
  let httpServer = null;
  let transport = null;
  let bonjour = null;
  let mdnsService = null;
  let status = {
    enabled: false,
    running: false,
    host: DEFAULT_HOST,
    port: null,
    url: '',
    token: '',
    error: '',
  };

  async function start() {
    if (!getSettings().pet.mcpEnabled) {
      status = { ...status, enabled: false, running: false, error: '' };
      return getStatus();
    }
    if (httpServer) return getStatus();

    try {
      const settings = getSettings();
      const bindHost = getBindHost(settings);
      const [{ McpServer }, { NodeStreamableHTTPServerTransport }, z] = await Promise.all([
        import('@modelcontextprotocol/server'),
        import('@modelcontextprotocol/node'),
        import('zod/v4'),
      ]);
      const token = getTokenValue(settings);
      const mcpServer = new McpServer({ name: 'pawkeeper-pet', version: '1.0.0' });
      transport = new NodeStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
      registerPetTools({ mcpServer, z, petController, getSettings, saveSettings });
      await mcpServer.connect(transport);

      httpServer = http.createServer(async (req, res) => {
        if (!req.url) {
          res.writeHead(400).end('Missing URL');
          return;
        }
        const url = new URL(req.url, `http://${DEFAULT_HOST}`);
        if (url.pathname === HEALTH_PATH) {
          sendJson(res, 200, { ok: true, service: 'pawkeeper-pet', mcp: MCP_PATH, state: STATE_PATH });
          return;
        }
        if (url.pathname === STATE_PATH) {
          if (!isAuthorized(req, url, token)) {
            sendJson(res, 401, { error: 'Unauthorized. Use the token from Pawkeeper settings.' });
            return;
          }
          await handleStateRequest({ req, res, petController });
          return;
        }
        if (url.pathname !== MCP_PATH) {
          res.writeHead(404).end('Not found');
          return;
        }
        if (!isAuthorized(req, url, token)) {
          sendJson(res, 401, { error: 'Unauthorized. Use the token from Pawkeeper settings.' });
          return;
        }
        await transport.handleRequest(req, res);
      });

      await listenWithFallback(httpServer, DEFAULT_PORT, bindHost);
      const address = httpServer.address();
      const port = typeof address === 'object' && address ? address.port : null;
      const publicHost = getPublicHost(settings);
      if (port && settings.pet.mcpLanEnabled) {
        startMdnsAdvertisement(port, token, publicHost);
      }
      status = {
        enabled: true,
        running: true,
        host: bindHost,
        publicHost,
        port,
        url: port ? `http://${publicHost}:${port}${MCP_PATH}` : '',
        token,
        error: '',
      };
    } catch (error) {
      status = {
        ...status,
        enabled: true,
        running: false,
        error: error.message || String(error),
      };
      logger.warn?.('Failed to start Pawkeeper MCP server:', error);
    }

    return getStatus();
  }

  async function stop() {
    stopMdnsAdvertisement();
    if (transport) {
      await transport.close().catch(() => {});
      transport = null;
    }
    if (httpServer) {
      await new Promise((resolve) => httpServer.close(resolve));
      httpServer = null;
    }
    status = {
      ...status,
      running: false,
      port: null,
      url: '',
    };
    return getStatus();
  }

  async function sync() {
    const settings = getSettings();
    if (settings.pet.mcpEnabled) {
      const desiredHost = getBindHost(settings);
      const desiredPublicHost = getPublicHost(settings);
      if (httpServer && (status.host !== desiredHost || status.publicHost !== desiredPublicHost)) {
        await stop();
      }
      return start();
    }
    return stop();
  }

  function getStatus() {
    const settings = getSettings();
    const token = getTokenValue(settings);
    const lanUrls = status.port && settings.pet.mcpLanEnabled
      ? getLanAddresses().map((address) => `http://${address}:${status.port}${MCP_PATH}`)
      : [];
    const lanStateUrls = status.port && settings.pet.mcpLanEnabled
      ? getLanAddresses().map((address) => `http://${address}:${status.port}${STATE_PATH}`)
      : [];
    const localDomain = settings.pet.mcpLanEnabled ? getConfiguredLocalDomain(settings) : '';
    const localDomainUrl = status.port && settings.pet.mcpLanEnabled
      ? `http://${localDomain}:${status.port}${MCP_PATH}`
      : '';
    const localDomainStateUrl = status.port && settings.pet.mcpLanEnabled
      ? `http://${localDomain}:${status.port}${STATE_PATH}`
      : '';
    const preferredLanUrl = process.platform === 'win32' && lanUrls.length > 0
      ? lanUrls[0]
      : localDomainUrl;
    return {
      ...status,
      enabled: settings.pet.mcpEnabled,
      token,
      platform: process.platform,
      mcpPath: MCP_PATH,
      stateUrl: status.port ? `http://${DEFAULT_HOST}:${status.port}${STATE_PATH}` : '',
      healthUrl: status.port ? `http://${DEFAULT_HOST}:${status.port}${HEALTH_PATH}` : '',
      lanEnabled: settings.pet.mcpLanEnabled,
      localDomain,
      localDomainUrl,
      localDomainStateUrl,
      mdnsService: settings.pet.mcpLanEnabled && status.running
        ? {
          name: MDNS_SERVICE_NAME,
          type: `_${MDNS_SERVICE_TYPE}._tcp`,
          host: localDomain,
          path: MCP_PATH,
          statePath: STATE_PATH,
        }
        : null,
      lanUrls,
      lanStateUrls,
      cursorGlobalPath: '~/.cursor/mcp.json',
      cursorProjectPath: '.cursor/mcp.json',
      localCursorConfigSnippet: status.port
        ? createMcpConfigSnippet(`http://${DEFAULT_HOST}:${status.port}${MCP_PATH}`, token)
        : '',
      lanCursorConfigSnippet: preferredLanUrl
        ? createMcpConfigSnippet(preferredLanUrl, token)
        : '',
      cursorConfigSnippet: status.url
        ? createMcpConfigSnippet(status.url, token)
        : '',
      configSnippet: status.url
        ? createMcpConfigSnippet(status.url, token)
        : '',
      tokenValue: token,
      curlSetStateExample: status.port
        ? createCurlSetStateExample(`http://${DEFAULT_HOST}:${status.port}${STATE_PATH}`, token)
        : '',
      lanCurlSetStateExample: status.port && getSettings().pet.mcpLanEnabled
        ? createCurlSetStateExample(`http://${getConfiguredLocalDomain(getSettings())}:${status.port}${STATE_PATH}`, token)
        : '',
      tools: [
        'pet_get_state',
        'pet_list_states',
        'pet_set_state',
        'pet_clear_state',
        'pet_set_interaction',
      ],
    };
  }

  function getTokenValue(settings = getSettings()) {
    if (!settings.pet.mcpTokenRequired) return '';
    const existingToken = getToken();
    if (existingToken) return existingToken;
    const token = crypto.randomBytes(24).toString('hex');
    setToken(token);
    return token;
  }

  async function rotateToken() {
    const token = crypto.randomBytes(24).toString('hex');
    setToken(token);
    const settings = getSettings();
    saveSettings({
      ...settings,
      pet: {
        ...settings.pet,
        mcpTokenRequired: true,
      },
    });
    if (httpServer) {
      await stop();
      await start();
    }
    return getStatus();
  }

  function startMdnsAdvertisement(port, token, host) {
    stopMdnsAdvertisement();
    bonjour = new Bonjour();
    mdnsService = bonjour.publish({
      name: MDNS_SERVICE_NAME,
      type: MDNS_SERVICE_TYPE,
      port,
      protocol: 'tcp',
      host,
      txt: {
        app: 'pawkeeper',
        mcpPath: MCP_PATH,
        statePath: STATE_PATH,
        healthPath: HEALTH_PATH,
        auth: token ? 'bearer' : 'none',
      },
    });
  }

  function stopMdnsAdvertisement() {
    if (mdnsService) {
      try {
        mdnsService.stop?.();
      } catch (_error) {}
      mdnsService = null;
    }
    if (bonjour) {
      try {
        bonjour.destroy();
      } catch (_error) {}
      bonjour = null;
    }
  }

  return {
    getStatus,
    rotateToken,
    start,
    stop,
    sync,
  };
}

async function handleStateRequest({ req, res, petController }) {
  if (req.method === 'GET') {
    sendJson(res, 200, petController.getPetRuntimeState());
    return;
  }

  if (req.method === 'POST') {
    try {
      const body = await readJsonBody(req);
      const state = typeof body.state === 'string' ? body.state : 'waving';
      const durationMs = Number.isFinite(body.durationMs) ? body.durationMs : undefined;
      const playCount = Number.isFinite(body.playCount) ? body.playCount : undefined;
      const message = typeof body.message === 'string' ? body.message : '';
      sendJson(res, 200, petController.setPetState('mcp', state, { durationMs, message, playCount }));
    } catch (error) {
      sendJson(res, 400, { error: error.message || String(error) });
    }
    return;
  }

  if (req.method === 'DELETE') {
    sendJson(res, 200, petController.clearPetState('mcp'));
    return;
  }

  sendJson(res, 405, { error: 'Method not allowed. Use GET, POST, or DELETE.' });
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let rawBody = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      rawBody += chunk;
      if (rawBody.length > 64 * 1024) {
        reject(new Error('Request body is too large.'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!rawBody.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(rawBody));
      } catch (error) {
        reject(new Error(`Invalid JSON body: ${error.message}`));
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'content-type': 'application/json' });
  res.end(JSON.stringify(payload));
}

function getBindHost(settings) {
  return settings.pet.mcpLanEnabled ? LAN_HOST : DEFAULT_HOST;
}

function getPublicHost(settings) {
  return settings.pet.mcpLanEnabled ? getConfiguredLocalDomain(settings) : DEFAULT_HOST;
}

function getConfiguredLocalDomain(settings) {
  return settings.pet.mcpLocalDomain || getLocalMdnsHostName();
}

function getLocalMdnsHostName(hostname = os.hostname()) {
  const safeHostName = String(hostname || 'pawkeeper')
    .replace(/\.local$/i, '')
    .replace(/[^a-zA-Z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'pawkeeper';
  return `${safeHostName}.local`;
}

function getLanAddresses() {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((item) => item && item.family === 'IPv4' && !item.internal)
    .map((item) => item.address);
}

function createMcpConfigSnippet(url, token) {
  const serverConfig = { url };
  if (token) {
    serverConfig.headers = {
      Authorization: `Bearer ${token}`,
    };
  }

  return JSON.stringify({
    mcpServers: {
      'pawkeeper-pet': serverConfig,
    },
  }, null, 2);
}

function createCurlSetStateExample(url, token) {
  const authHeader = token ? ` -H "Authorization: Bearer ${token}"` : '';
  return `curl -X POST ${url} -H "Content-Type: application/json"${authHeader} --data '{"state":"waving","playCount":3,"message":"Hi"}'`;
}

async function listenWithFallback(server, preferredPort, host) {
  try {
    await listen(server, preferredPort, host);
  } catch (error) {
    if (error.code !== 'EADDRINUSE') throw error;
    await listen(server, 0, host);
  }
}

function listen(server, port, host) {
  return new Promise((resolve, reject) => {
    const onError = (error) => {
      server.off('listening', onListening);
      reject(error);
    };
    const onListening = () => {
      server.off('error', onError);
      resolve();
    };
    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(port, host);
  });
}

function registerPetTools({ mcpServer, z, petController, getSettings, saveSettings }) {
  const stateSchema = z.enum([
    ...petController.getPetRuntimeState().availableStates,
    'running-right',
    'running-left',
  ]);

  mcpServer.registerTool(
    'pet_get_state',
    {
      description: 'Get the current Pawkeeper desktop pet, animation state, and MCP server status.',
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true },
    },
    async () => toToolResult(petController.getPetRuntimeState())
  );

  mcpServer.registerTool(
    'pet_list_states',
    {
      description: 'List available Codex pet animation states.',
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true },
    },
    async () => toToolResult({
      states: petController.getPetRuntimeState().availableStates,
      current: petController.getPetRuntimeState(),
    })
  );

  mcpServer.registerTool(
    'pet_set_state',
    {
      description: 'Set a temporary or persistent animation state for the desktop pet.',
      inputSchema: z.object({
        state: stateSchema,
        durationMs: z.number().int().min(0).max(600000).optional(),
        playCount: z.number().int().min(1).max(100).optional(),
        message: z.string().max(120).optional(),
      }),
      annotations: { destructiveHint: false, idempotentHint: false },
    },
    async ({ state, durationMs, playCount, message }) => toToolResult(
      petController.setPetState('mcp', state, { durationMs, playCount, message })
    )
  );

  mcpServer.registerTool(
    'pet_clear_state',
    {
      description: 'Clear MCP control and return the pet to app and mouse driven behavior.',
      inputSchema: z.object({}),
      annotations: { destructiveHint: false, idempotentHint: true },
    },
    async () => toToolResult(petController.clearPetState('mcp'))
  );

  mcpServer.registerTool(
    'pet_set_interaction',
    {
      description: 'Update mouse interaction settings for the desktop pet.',
      inputSchema: z.object({
        interactionEnabled: z.boolean().optional(),
        interactionMode: z.enum(['quiet', 'playful', 'follow']).optional(),
        lookAtCursor: z.boolean().optional(),
        followCursor: z.boolean().optional(),
        avoidCursor: z.boolean().optional(),
        reducedMotion: z.boolean().optional(),
      }),
      annotations: { destructiveHint: false, idempotentHint: false },
    },
    async (updates) => {
      const settings = getSettings();
      const nextSettings = {
        ...settings,
        pet: {
          ...settings.pet,
          ...updates,
        },
      };
      const normalizedSettings = saveSettings(nextSettings);
      return toToolResult({
        updated: updates,
        currentPetSettings: normalizedSettings.pet,
      });
    }
  );

  mcpServer.registerResource(
    'pet-state',
    'pet://state',
    {
      title: 'Pawkeeper Pet State',
      description: 'Current desktop pet state and available animation states.',
      mimeType: 'application/json',
    },
    async (uri) => ({
      contents: [{
        uri: uri.href,
        mimeType: 'application/json',
        text: JSON.stringify(petController.getPetRuntimeState(), null, 2),
      }],
    })
  );
}

function toToolResult(value) {
  return {
    structuredContent: value,
    content: [{
      type: 'text',
      text: JSON.stringify(value, null, 2),
    }],
  };
}

function isAuthorized(req, url, token) {
  if (!token) return true;
  const authHeader = req.headers.authorization || '';
  const headerToken = Array.isArray(authHeader) ? authHeader[0] : authHeader;
  return headerToken === `Bearer ${token}` ||
    req.headers['x-pawkeeper-token'] === token ||
    req.headers['x-break-neko-token'] === token;
}

module.exports = {
  createMcpConfigSnippet,
  createPetMcpServerController,
  getConfiguredLocalDomain,
  getLocalMdnsHostName,
};
