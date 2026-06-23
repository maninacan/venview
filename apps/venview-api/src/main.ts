import express from 'express';
import cors from 'cors';
import http from 'http';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@as-integrations/express5';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import { typeDefs } from './schema/typeDefs.js';
import { resolvers } from './schema/resolvers/index.js';
import { createContext } from './context/index.js';
import healthRouter from './routes/health.js';
import squareRouter from './routes/square.js';
import uploadsRouter from './routes/uploads.js';
import logger from './lib/logger.js';
import billingRouter from './routes/billing.js';

const host = process.env['HOST'] ?? 'localhost';
const port = process.env['PORT'] ? Number(process.env['PORT']) : 3000;

const clientOrigin = process.env['CLIENT_URL'] ?? 'http://localhost:4200';
const superAdminOrigin = process.env['SUPER_ADMIN_URL'] ?? 'http://localhost:4202';

async function main() {
  const app = express();
  const httpServer = http.createServer(app);

  const server = new ApolloServer({
    typeDefs,
    resolvers,
    plugins: [ApolloServerPluginDrainHttpServer({ httpServer })],
    introspection: true,
  });

  await server.start();

  app.use(
    cors({
      origin: [clientOrigin, superAdminOrigin, 'https://studio.apollographql.com'],
      credentials: true,
    })
  );

  // Stripe webhook needs the raw, unparsed body for signature verification —
  // register it before the global JSON parser.
  app.use('/api/billing/webhook', express.raw({ type: 'application/json' }));

  app.use(express.json());

  // HTTP request logging
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      logger.info('http', {
        method: req.method,
        url: req.originalUrl,
        status: res.statusCode,
        durationMs: Date.now() - start,
        ip: req.ip,
      });
    });
    next();
  });

  // REST routes
  app.use('/api', healthRouter);
  app.use('/api', squareRouter);
  app.use('/api', uploadsRouter);
  app.use('/api', billingRouter);

  // GraphQL endpoint
  app.use(
    '/graphql',
    expressMiddleware(server, {
      context: ({ req }) => createContext(req),
    })
  );

  httpServer.listen({ port, host }, () => {
    logger.info(`server ready at http://${host}:${port}/graphql`);
  });
}

main().catch((err) => {
  logger.error('Failed to start server', { error: err });
  process.exit(1);
});
