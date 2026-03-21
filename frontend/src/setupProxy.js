/**
 * Proxy explícito hacia FastAPI (puerto 8000).
 * Sustituye el campo "proxy" de package.json para asegurar que PATCH/PUT/DELETE
 * se reenvíen igual que GET (en algunos entornos el proxy simple fallaba en mutaciones).
 */
const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function setupProxy(app) {
  const target = process.env.REACT_APP_PROXY_TARGET || 'http://127.0.0.1:8000';

  app.use(
    '/api',
    createProxyMiddleware({
      target,
      changeOrigin: true,
      secure: false,
    })
  );
};
