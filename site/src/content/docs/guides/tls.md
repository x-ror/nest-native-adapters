---
title: TLS
description: Native HTTPS or TLS termination at a reverse proxy.
---

The adapters serve HTTPS directly when you pass Nest `httpsOptions` (Bun
reads only `key`, `cert`, `ca` and `passphrase`). Otherwise terminate TLS at a
reverse proxy such as Nginx, and keep the application listener reachable only
from that proxy, for example by binding to `127.0.0.1` or a private container
network. Set the proxy's request-body limit to match the adapter's
`bodyLimit`, which defaults to 100 KiB.

Packed consumers verify direct HTTPS on Node and Bun for Nest 10/11/12 using
an isolated, short-lived self-signed localhost certificate. They also confirm
Nest request metadata reports `protocol: "https"` and `secure: true`.

Example Nginx configuration for an app listening on `127.0.0.1:3000`:

```nginx
server {
    listen 80;
    server_name example.com;
    return 301 https://example.com$request_uri;
}

server {
    listen 443 ssl;
    server_name example.com;

    ssl_certificate     /etc/letsencrypt/live/example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/example.com/privkey.pem;
    client_max_body_size 1m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

With the `1m` proxy limit, configure the adapter with
`{ bodyLimit: 1024 * 1024 }`.
