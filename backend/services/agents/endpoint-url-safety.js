const net = require('net');
const dns = require('dns').promises;

const PRIVATE_IPV4_RANGES = [
  ['0.0.0.0', '0.255.255.255'],
  ['10.0.0.0', '10.255.255.255'],
  ['100.64.0.0', '100.127.255.255'],
  ['127.0.0.0', '127.255.255.255'],
  ['169.254.0.0', '169.254.255.255'],
  ['172.16.0.0', '172.31.255.255'],
  ['192.0.0.0', '192.0.0.255'],
  ['192.168.0.0', '192.168.255.255'],
  ['198.18.0.0', '198.19.255.255'],
  ['224.0.0.0', '255.255.255.255'],
];

function ipv4ToLong(ip) {
  return ip
    .split('.')
    .map((item) => Number.parseInt(item, 10))
    .reduce((acc, item) => (acc << 8) + item, 0) >>> 0;
}

function isPrivateIpv4(ip) {
  const value = ipv4ToLong(ip);
  return PRIVATE_IPV4_RANGES.some(([start, end]) => {
    const startValue = ipv4ToLong(start);
    const endValue = ipv4ToLong(end);
    return value >= startValue && value <= endValue;
  });
}

function normalizeIpv6(ip) {
  return ip.toLowerCase();
}

function stripIpv6Brackets(host) {
  if (typeof host !== 'string') {
    return host;
  }
  if (host.startsWith('[') && host.endsWith(']')) {
    return host.slice(1, -1);
  }
  return host;
}

function parseIpv4FromHexHextets(highHextet, lowHextet) {
  const high = Number.parseInt(highHextet, 16);
  const low = Number.parseInt(lowHextet, 16);
  if (!Number.isInteger(high) || !Number.isInteger(low)) {
    return null;
  }

  return [
    (high >> 8) & 0xff,
    high & 0xff,
    (low >> 8) & 0xff,
    low & 0xff,
  ].join('.');
}

function ipv6ToHextets(ipv6) {
  const normalized = stripIpv6Brackets(String(ipv6 || '')).toLowerCase();
  const [headPart, tailPart] = normalized.split('::');
  if (normalized.split('::').length > 2) {
    return null;
  }

  const parsePart = (part) => {
    if (!part) {
      return [];
    }
    return part.split(':').flatMap((segment) => {
      if (!segment) {
        return [];
      }
      if (segment.includes('.')) {
        if (net.isIP(segment) !== 4) {
          return [];
        }
        const octets = segment.split('.').map((item) => Number.parseInt(item, 10));
        return [((octets[0] << 8) | octets[1]).toString(16), ((octets[2] << 8) | octets[3]).toString(16)];
      }
      return [segment];
    });
  };

  const head = parsePart(headPart);
  const tail = parsePart(tailPart);
  const missingCount = 8 - (head.length + tail.length);
  if (missingCount < 0) {
    return null;
  }
  if (missingCount > 0 && !normalized.includes('::')) {
    return null;
  }

  return [...head, ...Array(missingCount).fill('0'), ...tail];
}

function getEmbeddedIpv4Address(ipv6) {
  const normalizedIpv6 = stripIpv6Brackets(String(ipv6 || '')).toLowerCase();
  if (net.isIP(normalizedIpv6) !== 6) {
    return null;
  }

  const hextets = ipv6ToHextets(normalizedIpv6);
  if (!Array.isArray(hextets) || hextets.length !== 8) {
    return null;
  }

  const firstFiveAreZero = hextets.slice(0, 5).every((segment) => Number.parseInt(segment, 16) === 0);
  if (!firstFiveAreZero) {
    return null;
  }

  const markerHextet = Number.parseInt(hextets[5], 16);
  const isMapped = markerHextet === 0xffff;
  const isCompatible = markerHextet === 0x0000;
  if (!isMapped && !isCompatible) {
    return null;
  }

  return parseIpv4FromHexHextets(hextets[6], hextets[7]);
}

function isPrivateIpv6(ip) {
  const value = normalizeIpv6(stripIpv6Brackets(ip));
  const firstHextetRaw = value.split(':')[0];
  const firstHextet = firstHextetRaw ? Number.parseInt(firstHextetRaw, 16) : 0;
  const embeddedIpv4 = getEmbeddedIpv4Address(value);
  return (
    value === '::1' ||
    value === '::' ||
    value.startsWith('fc') ||
    value.startsWith('fd') ||
    (Number.isInteger(firstHextet) && firstHextet >= 0xfe80 && firstHextet <= 0xfebf) ||
    (Number.isInteger(firstHextet) && firstHextet >= 0xfec0 && firstHextet <= 0xfeff) ||
    (embeddedIpv4 && isPrivateIpv4(embeddedIpv4)) ||
    value.startsWith('ff')
  );
}

function isPrivateIpAddress(host) {
  const normalizedHost = stripIpv6Brackets(host);
  const embeddedIpv4 = getEmbeddedIpv4Address(normalizeIpv6(normalizedHost));
  if (embeddedIpv4 && isPrivateIpv4(embeddedIpv4)) {
    return true;
  }

  const ipVersion = net.isIP(normalizedHost);
  if (ipVersion === 4) {
    return isPrivateIpv4(normalizedHost);
  }
  if (ipVersion === 6) {
    return isPrivateIpv6(normalizedHost);
  }
  return false;
}

function validateRemoteEndpointUrl(baseUrl) {
  let parsed;
  try {
    parsed = new URL(baseUrl);
  } catch {
    const error = new Error('baseUrl must be a valid absolute URL');
    error.statusCode = 400;
    throw error;
  }

  if (parsed.protocol !== 'https:') {
    const error = new Error('baseUrl must use https');
    error.statusCode = 400;
    throw error;
  }

  if (!parsed.hostname) {
    const error = new Error('baseUrl must include a hostname');
    error.statusCode = 400;
    throw error;
  }

  if (isPrivateIpAddress(parsed.hostname)) {
    const error = new Error('baseUrl host must not be a private or local IP');
    error.statusCode = 400;
    throw error;
  }

  return parsed;
}

async function assertHostnameResolvesPublicIp(hostname) {
  const normalizedHost = stripIpv6Brackets(hostname);
  const results = await dns.lookup(normalizedHost, { all: true, verbatim: true });
  if (!Array.isArray(results) || results.length === 0) {
    throw new Error('Endpoint hostname could not be resolved');
  }

  const privateAddress = results.find((item) => isPrivateIpAddress(item.address));
  if (privateAddress) {
    const error = new Error('Endpoint hostname resolves to a private or local IP');
    error.code = 'endpoint_private_network';
    error.statusCode = 400;
    throw error;
  }
}

module.exports = {
  validateRemoteEndpointUrl,
  assertHostnameResolvesPublicIp,
};
