/**
 * Назначение: создание аутентифицированных роутеров для AdminJS на Express и
 * Fastify. Используются сессии и хеширование паролей.
 * Ключевые модули: AdminJSExpress, AdminJSFastify, express-session,
 * connect-mongo, argon2.
 */
import AdminJSExpress from '@adminjs/express';
import AdminJSFastify from '@adminjs/fastify';
import AdminJS from 'adminjs';
import argon2 from 'argon2';
import { FastifyInstance } from 'fastify';
import MongoStore from 'connect-mongo';
import session from 'express-session';
import { Router } from 'express';

import { AdminModel } from '../sources/mongoose/models/index.js';
import { AuthUsers } from './constants/authUsers.js';

export const authenticateUser = async (email, password) => {
  const user = await AdminModel.findOne({ email });
  if (user && (await argon2.verify(user.password, password))) {
    const userData = AuthUsers.find((au) => email === au.email);
    return { ...userData, ...user.toObject() };
  }
  return null;
};

export const expressAuthenticatedRouter = (
  adminJs: AdminJS,
  router: Router | null = null,
) => {
  const sessionStore = MongoStore.create({
    mongoUrl: process.env.MONGO_DATABASE_URL,
    collectionName: 'session',
  });

  return AdminJSExpress.buildAuthenticatedRouter(
    adminJs,
    {
      authenticate: authenticateUser,
      cookieName: 'adminjs',
      cookiePassword: process.env.SESSION_SECRET ?? 'sessionsecret',
    },
    router,
    {
      store: sessionStore,
      resave: true,
      saveUninitialized: true,
      secret: process.env.SESSION_SECRET ?? 'sessionsecret',
      cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
      },
      name: 'adminjs',
    },
  );
};

export const fastifyAuthenticatedRouter = (adminJs: AdminJS, app: FastifyInstance) =>
  AdminJSFastify.buildAuthenticatedRouter(
    adminJs,
    {
      cookiePassword: 'secretsecretsecretsecretsecretsecretsecretsecret',
      authenticate: authenticateUser,
    },
    app,
  );
