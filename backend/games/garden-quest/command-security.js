const CHAT_ALLOWED_CHAR_PATTERN = /^[\p{L}\p{N}\s.,!?'"()\-:]+$/u;
const PROFILE_NICKNAME_ALLOWED_CHAR_PATTERN = /^[\p{L}\p{N}\s.'_-]+$/u;
const PROFILE_HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;
const PLAYER_NICKNAME_MAX_LENGTH = 24;

const DANGEROUS_STRING_RULES = [
  {
    pattern: /[\u0000-\u001f\u007f]/,
    description: 'contains control characters',
  },
  {
    pattern: /<\s*script\b/i,
    description: 'contains script tag pattern',
  },
  {
    pattern: /<\/?[a-z][^>]*>/i,
    description: 'contains HTML tag pattern',
  },
  {
    pattern: /on[a-z]+\s*=/i,
    description: 'contains inline event handler pattern',
  },
  {
    pattern: /javascript\s*:/i,
    description: 'contains javascript protocol pattern',
  },
  {
    pattern:
      /\b(?:union\s+select|drop\s+table|insert\s+into|delete\s+from|update\s+\w+\s+set|alter\s+table)\b/i,
    description: 'contains SQL injection pattern',
  },
  {
    pattern: /--|\/\*|\*\//,
    description: 'contains SQL comment marker',
  },
  {
    pattern: /\$\(|`[^`]*`/,
    description: 'contains shell substitution pattern',
  },
  {
    pattern: /&&|\|\|/,
    description: 'contains shell chaining operator',
  },
  {
    pattern: /\.\.[\\/]/,
    description: 'contains path traversal pattern',
  },
  {
    pattern: /\{\{.*\}\}|\$\{.*\}/,
    description: 'contains template expression pattern',
  },
];

function buildPreview(value, maxLength = 80) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function pushDangerousStringIssues(value, path, issues) {
  for (const rule of DANGEROUS_STRING_RULES) {
    if (rule.pattern.test(value)) {
      issues.push({
        path,
        description: rule.description,
        preview: buildPreview(value),
      });
    }
  }
}

function walkForSuspiciousStrings(value, path, issues) {
  if (typeof value === 'string') {
    pushDangerousStringIssues(value, path, issues);
    return;
  }

  if (!value || typeof value !== 'object') {
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((entry, index) => {
      walkForSuspiciousStrings(entry, `${path}[${index}]`, issues);
    });
    return;
  }

  Object.entries(value).forEach(([key, entry]) => {
    walkForSuspiciousStrings(entry, `${path}.${key}`, issues);
  });
}

function normalizeAxis(value) {
  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return null;
  }

  return Math.max(-1, Math.min(1, numeric));
}

function normalizeBoolean(value, defaultValue = false) {
  if (value == null) {
    return defaultValue;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  return null;
}

function validatePlayerCommandBody(body, { chatMaxChars }) {
  const suspiciousIssues = [];
  const validationErrors = [];

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return {
      ok: false,
      suspiciousIssues,
      validationErrors: ['Request body must be an object.'],
      normalizedCommand: null,
    };
  }

  walkForSuspiciousStrings(body, 'body', suspiciousIssues);

  const type = typeof body.type === 'string' ? body.type.trim() : '';
  const payload =
    body.payload && typeof body.payload === 'object' && !Array.isArray(body.payload)
      ? body.payload
      : {};

  let normalizedCommand = null;

  switch (type) {
    case 'set_input': {
      const moveX = normalizeAxis(payload.moveX);
      const moveZ = normalizeAxis(payload.moveZ);
      const isRunning = normalizeBoolean(payload.isRunning, false);

      if (moveX == null || moveZ == null) {
        validationErrors.push('Movement input must be finite numeric values.');
      } else if (isRunning == null) {
        validationErrors.push('Running input must be a boolean value.');
      } else {
        normalizedCommand = {
          type,
          payload: {
            moveX,
            moveZ,
            isRunning,
          },
        };
      }
      break;
    }
    case 'perform_action':
    case 'use_action':
    case 'toggle_fruit':
      normalizedCommand = {
        type,
        payload: {},
      };
      break;
    case 'chat': {
      const message =
        typeof payload.message === 'string' ? payload.message.replace(/\s+/g, ' ').trim() : '';

      if (!message) {
        validationErrors.push('Chat message is required.');
      } else if (message.length > chatMaxChars) {
        validationErrors.push(`Chat message exceeds ${chatMaxChars} characters.`);
      } else {
        if (!CHAT_ALLOWED_CHAR_PATTERN.test(message)) {
          suspiciousIssues.push({
            path: 'body.payload.message',
            description: 'contains characters outside the chat whitelist',
            preview: buildPreview(message),
          });
        }

        normalizedCommand = {
          type,
          payload: {
            message,
          },
        };
      }
      break;
    }
    case 'update_profile': {
      const nickname =
        typeof payload.nickname === 'string' ? payload.nickname.replace(/\s+/g, ' ').trim() : '';
      const outfitColor =
        typeof payload.outfitColor === 'string' ? payload.outfitColor.trim().toLowerCase() : '';

      if (!nickname) {
        validationErrors.push('Nickname is required.');
      } else if (nickname.length > PLAYER_NICKNAME_MAX_LENGTH) {
        validationErrors.push(`Nickname exceeds ${PLAYER_NICKNAME_MAX_LENGTH} characters.`);
      } else if (!PROFILE_NICKNAME_ALLOWED_CHAR_PATTERN.test(nickname)) {
        suspiciousIssues.push({
          path: 'body.payload.nickname',
          description: 'contains characters outside the nickname whitelist',
          preview: buildPreview(nickname),
        });
      }

      if (!PROFILE_HEX_COLOR_PATTERN.test(outfitColor)) {
        validationErrors.push('Outfit color must be a valid hex color.');
      }

      if (validationErrors.length === 0) {
        normalizedCommand = {
          type,
          payload: {
            nickname,
            outfitColor,
          },
        };
      }
      break;
    }
    default:
      validationErrors.push('Unsupported command type.');
      break;
  }

  return {
    ok:
      suspiciousIssues.length === 0 && validationErrors.length === 0 && Boolean(normalizedCommand),
    suspiciousIssues,
    validationErrors,
    normalizedCommand,
  };
}

function formatSuspicionDetails(issues) {
  return issues
    .map((issue) => {
      const preview = issue.preview ? `; preview="${issue.preview}"` : '';
      return `${issue.path}: ${issue.description}${preview}`;
    })
    .join(' | ');
}

module.exports = {
  formatSuspicionDetails,
  validatePlayerCommandBody,
};
