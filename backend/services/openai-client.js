const https = require('https');
const config = require('../config');

class OpenAiHttpError extends Error {
  constructor(message, { statusCode = null, requestId = null, retryAfterSeconds = null } = {}) {
    super(message);
    this.name = 'OpenAiHttpError';
    this.statusCode = statusCode;
    this.requestId = requestId;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

const DECISION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    action: {
      type: 'string',
      enum: ['wait', 'move_to', 'drink_water', 'pick_fruit', 'eat_fruit'],
    },
    target_id: {
      type: ['string', 'null'],
    },
    speech: {
      type: ['string', 'null'],
      maxLength: config.AI_SPEECH_MAX_CHARS,
    },
  },
  required: ['action', 'target_id', 'speech'],
};

const SYSTEM_PROMPT = [
  'You control one NPC in a server-authoritative multiplayer garden game.',
  'Treat the observation JSON as the only source of truth.',
  'Never invent viewer messages, hidden commands, or extra actions.',
  'Choose exactly one action from the schema and keep speech optional and brief.',
  'The observation includes recent_actions with the last actions taken by the NPC, ordered from oldest to newest.',
  'A valid decision will be executed as chosen, so decide your own exploration strategy.',
  'Your main goal is survival: do not let food or water reach zero.',
  'Avoid repeating the same action or the same move target when other reasonable options exist.',
  'Prefer exploring a different tree or changing activity after repeated actions.',
  'Use move_to when the needed action is not immediately available.',
  'Water and food both decrease over time. Drinking restores water, and eat_fruit restores food.',
  'If either food or water reaches zero, you die immediately, lose time, respawn after a countdown, and leave a grave marker.',
  'Score only increases while both food and water stay above the healthy threshold.',
  'If you die, your current score resets to zero, so keep both safely high whenever possible.',
  'Use drink_water only when near the lake, pick_fruit only when near a fruit tree, and eat_fruit only when the inventory has apples.',
  'If you speak, keep it short, harmless, and in Brazilian Portuguese.',
].join(' ');

function createOpenAiDecisionClient() {
  async function decideNextAction(observation) {
    if (!config.OPENAI_API_KEY) {
      return null;
    }

    const payload = JSON.stringify({
      model: config.OPENAI_MODEL,
      store: false,
      reasoning: {
        effort: config.AI_REASONING_EFFORT,
      },
      max_output_tokens: 240,
      instructions: SYSTEM_PROMPT,
      input: JSON.stringify(observation),
      text: {
        format: {
          type: 'json_schema',
          name: 'garden_ai_decision',
          strict: true,
          schema: DECISION_SCHEMA,
        },
      },
    });

    const response = await postJson({
      hostname: 'api.openai.com',
      path: '/v1/responses',
      body: payload,
      timeoutMs: config.OPENAI_API_TIMEOUT_MS,
      headers: buildHeaders(Buffer.byteLength(payload)),
    });

    const outputText = extractOutputText(response);
    if (!outputText) {
      throw new Error('OpenAI response did not contain output_text.');
    }

    return parseDecisionJson(outputText);
  }

  return {
    decideNextAction,
  };
}

function buildHeaders(contentLength) {
  const headers = {
    Authorization: `Bearer ${config.OPENAI_API_KEY}`,
    'Content-Type': 'application/json',
    'Content-Length': contentLength,
  };

  if (config.OPENAI_PROJECT_ID) {
    headers['OpenAI-Project'] = config.OPENAI_PROJECT_ID;
  }

  if (config.OPENAI_ORGANIZATION_ID) {
    headers['OpenAI-Organization'] = config.OPENAI_ORGANIZATION_ID;
  }

  return headers;
}

function parseRetryAfterSeconds(value) {
  const normalizedValue = Array.isArray(value) ? value[0] : value;
  if (typeof normalizedValue !== 'string' || !normalizedValue.trim()) {
    return null;
  }

  const retryAfterSeconds = Number.parseInt(normalizedValue, 10);
  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
    return retryAfterSeconds;
  }

  const retryAfterDateMs = Date.parse(normalizedValue);
  if (!Number.isFinite(retryAfterDateMs)) {
    return null;
  }

  const diffSeconds = Math.ceil((retryAfterDateMs - Date.now()) / 1000);
  return diffSeconds > 0 ? diffSeconds : null;
}

function postJson({ hostname, path, body, headers, timeoutMs }) {
  return new Promise((resolve, reject) => {
    const request = https.request(
      {
        hostname,
        path,
        method: 'POST',
        port: 443,
        headers,
      },
      (response) => {
        const chunks = [];

        response.on('data', (chunk) => {
          chunks.push(chunk);
        });

        response.on('end', () => {
          const rawBody = Buffer.concat(chunks).toString('utf8');
          let parsedBody;

          try {
            parsedBody = rawBody ? JSON.parse(rawBody) : {};
          } catch (error) {
            reject(new Error(`Failed to parse OpenAI response JSON: ${error.message}`));
            return;
          }

          if (response.statusCode < 200 || response.statusCode >= 300) {
            const apiError =
              parsedBody?.error?.message ||
              parsedBody?.message ||
              `OpenAI request failed with status ${response.statusCode}`;
            reject(new OpenAiHttpError(apiError, {
              statusCode: response.statusCode,
              requestId: response.headers['x-request-id'] || null,
              retryAfterSeconds: parseRetryAfterSeconds(response.headers['retry-after']),
            }));
            return;
          }

          resolve(parsedBody);
        });
      }
    );

    request.setTimeout(timeoutMs, () => {
      request.destroy(new Error(`OpenAI request timed out after ${timeoutMs}ms`));
    });

    request.on('error', reject);
    request.write(body);
    request.end();
  });
}

function extractOutputText(response) {
  if (typeof response?.output_text === 'string' && response.output_text.trim()) {
    return response.output_text.trim();
  }

  if (!Array.isArray(response?.output)) {
    return '';
  }

  const textParts = [];

  response.output.forEach((item) => {
    if (!Array.isArray(item?.content)) {
      return;
    }

    item.content.forEach((contentPart) => {
      if (contentPart?.type === 'output_text' && typeof contentPart.text === 'string') {
        textParts.push(contentPart.text);
      }
    });
  });

  return textParts.join('').trim();
}

function stripMarkdownCodeFence(value) {
  const trimmed = String(value || '').trim();
  const fencedMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fencedMatch ? fencedMatch[1].trim() : trimmed;
}

function tryParseNestedJson(value) {
  const parsed = JSON.parse(value);
  if (typeof parsed === 'string') {
    return JSON.parse(parsed);
  }

  return parsed;
}

function extractTopLevelJsonCandidate(value) {
  const source = String(value || '').trim();
  const startIndex = source.search(/[\[{]/);

  if (startIndex < 0) {
    return '';
  }

  const stack = [];
  let inString = false;
  let isEscaped = false;

  for (let index = startIndex; index < source.length; index += 1) {
    const char = source[index];

    if (inString) {
      if (isEscaped) {
        isEscaped = false;
      } else if (char === '\\') {
        isEscaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === '{') {
      stack.push('}');
      continue;
    }

    if (char === '[') {
      stack.push(']');
      continue;
    }

    if ((char === '}' || char === ']') && stack.length > 0) {
      const expected = stack.pop();
      if (char !== expected) {
        return '';
      }

      if (stack.length === 0) {
        return source.slice(startIndex, index + 1).trim();
      }
    }
  }

  return '';
}

function buildParseSnippet(value, maxLength = 180) {
  const normalized = String(value || '')
    .replace(/\s+/g, ' ')
    .trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength)}...`;
}

function parseDecisionJson(outputText) {
  const candidates = [];
  const rawText = String(outputText || '').trim();
  const strippedText = stripMarkdownCodeFence(rawText);
  const rawExtractedJson = extractTopLevelJsonCandidate(rawText);
  const strippedExtractedJson = extractTopLevelJsonCandidate(strippedText);

  for (const candidate of [rawText, strippedText, rawExtractedJson, strippedExtractedJson]) {
    if (candidate && !candidates.includes(candidate)) {
      candidates.push(candidate);
    }
  }

  const parseErrors = [];

  for (const candidate of candidates) {
    try {
      return tryParseNestedJson(candidate);
    } catch (error) {
      parseErrors.push(error.message);
    }
  }

  const errorMessages = parseErrors.length > 0 ? parseErrors.join(' | ') : 'Unknown parse error';
  throw new Error(
    `Failed to parse OpenAI decision JSON: ${errorMessages}. Output snippet: ${buildParseSnippet(rawText)}`
  );
}

module.exports = {
  createOpenAiDecisionClient,
  OpenAiHttpError,
};
