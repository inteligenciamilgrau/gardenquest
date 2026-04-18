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

function isPrivateIpv6(ip) {
  const value = normalizeIpv6(ip);
  return (
    value === '::1' ||
    value === '::' ||
    value.startsWith('fc') ||
    value.startsWith('fd') ||
    value.startsWith('fe80:') ||
    value.startsWith('ff')
  );
}

function isPrivateIpAddress(host) {
  const ipVersion = net.isIP(host);
  if (ipVersion === 4) {
    return isPrivateIpv4(host);
  }
  if (ipVersion === 6) {
    return isPrivateIpv6(host);
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
  const results = await dns.lookup(hostname, { all: true, verbatim: true });
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
