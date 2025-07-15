export function nginxTemplate({
  name,
  fqdn,
  backends = [],
  tls = false,
  port = 80,
  httpToHttps = false,
  websocket = false,
  headers = {},
  clientMaxBodySize,
  proxyTimeout,
  buffers = {},
  extraDirectives = '',
  locations = [],
  auth = null,
  ipAllow = [],
  ipDeny = [],
  accessLog = true,
  errorLog = true,
  logPaths = {
    access: `/var/log/nginx/${name}_access.log`,
    error: `/var/log/nginx/${name}_error.log`
  }
}) {
  const upstreamName = fqdn.replace(/\./g, '_');

  const upstreamBlock = `
upstream ${upstreamName} {
${backends.map(b => `    server ${b};`).join('\n')}
}
`;

  const baseHeaders = [
    `proxy_set_header Host $host;`,
    `proxy_set_header X-Real-IP $remote_addr;`,
    `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;`
  ];

  if (websocket) {
    baseHeaders.push(
      `proxy_http_version 1.1;`,
      `proxy_set_header Upgrade $http_upgrade;`,
      `proxy_set_header Connection "upgrade";`
    );
  }

  const headerDirectives = Object.entries(headers)
    .map(([k, v]) => `add_header ${k} "${v}";`)
    .join('\n        ');

  const authBlock = auth?.basic
    ? `auth_basic "${auth.basic.realm}";
        auth_basic_user_file /etc/nginx/auth/${name}.htpasswd;`
    : '';

  const ipFilter = [
    ...ipAllow.map(ip => `allow ${ip};`),
    ...ipDeny.map(ip => `deny ${ip};`),
    ipAllow.length || ipDeny.length ? 'deny all;' : ''
  ].join('\n        ');

  const bufferDirectives = [
    buffers.proxyBuffers ? `proxy_buffers ${buffers.proxyBuffers};` : '',
    buffers.proxyBufferSize ? `proxy_buffer_size ${buffers.proxyBufferSize};` : '',
    buffers.proxyBusyBuffersSize ? `proxy_busy_buffers_size ${buffers.proxyBusyBuffersSize};` : ''
  ].filter(Boolean).join('\n        ');

  const timeoutDirectives = proxyTimeout
    ? `proxy_read_timeout ${proxyTimeout};
        proxy_connect_timeout ${proxyTimeout};`
    : '';

  const loggingDirectives = `
    ${accessLog ? `access_log ${logPaths.access};` : 'access_log off;'}
    ${errorLog ? `error_log ${logPaths.error};` : 'error_log off;'}
  `.trim();

  const locationBlocks = locations.length > 0
    ? locations.map(loc => {
        return `
    location ${loc.path} {
        ${loc.proxyPass ? `proxy_pass ${loc.proxyPass};` : ''}
        ${(loc.extra || '').trim()}
    }`.trim();
      }).join('\n\n')
    : `
    location / {
        proxy_pass http://${upstreamName};
        ${baseHeaders.join('\n        ')}
        ${clientMaxBodySize ? `client_max_body_size ${clientMaxBodySize};` : ''}
        ${timeoutDirectives}
        ${headerDirectives}
        ${bufferDirectives}
        ${authBlock}
        ${ipFilter}
    }
    `.trim();

  const sslBlock = tls ? `
    ssl_certificate     /etc/nginx/ssl/${fqdn}.crt;
    ssl_certificate_key /etc/nginx/ssl/${fqdn}.key;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;
  ` : '';

  const httpRedirectServer = httpToHttps ? `
server {
    listen 80;
    server_name ${fqdn};
    return 301 https://${fqdn}$request_uri;
}
` : '';

  const mainServerBlock = `
server {
    listen ${port}${tls ? ' ssl' : ''};
    server_name ${fqdn};

    ${sslBlock}
    ${loggingDirectives}

    ${locationBlocks}
    ${extraDirectives}
}
`;

  return [upstreamBlock, httpRedirectServer, mainServerBlock]
    .filter(Boolean)
    .join('\n\n')
    .trim();
}
