/**
 * Назначение: конфигурирование AdminJS. Подключает адаптеры баз данных,
 * компоненты, страницы, темы и локализацию.
 * Ключевые модули: AdminJS, адаптеры различных ORM, компонент Loader.
 */
// Adapters
import { Database as MongooseDatabase, Resource as MongooseResource } from '@adminjs/mongoose';
import { dark, light, noSidebar } from '@adminjs/themes';

import AdminJS, { AdminJSOptions, ResourceOptions } from 'adminjs';
import argon2 from 'argon2';
import { AdminModel } from '../sources/mongoose/models/index.js';
import {
  CreateAdminResource,
  CreateArticleResource,
  CreateCategoryResource,
  CreateCommentResource,
  CreateComplicatedResource,
  CreateUserResource,
} from '../sources/mongoose/resources/index.js';
import './components.bundler.js';
import { componentLoader } from './components.bundler.js';
import { AuthUsers } from './constants/authUsers.js';
import { locale } from './locale/index.js';
import pages from './pages/index.js';
import { customTheme } from '../themes/index.js';

AdminJS.registerAdapter({ Database: MongooseDatabase, Resource: MongooseResource });


export const menu: Record<string, ResourceOptions['navigation']> = {
  mongoose: { name: 'Mongoose', icon: 'Folder' },
};

export const generateAdminJSConfig: () => AdminJSOptions = () => ({
  version: { admin: true, app: '2.0.0' },
  rootPath: '/admin',
  locale,
  assets: {
    styles: ['/custom.css'],
    scripts: [],
  },
  branding: {
    companyName: 'AGR MCS ERM',
    favicon: '/favicon.ico',
    theme: {
      colors: { primary100: '#4D70EB' },
    },
  },
  defaultTheme: 'light',
  availableThemes: [light, dark, noSidebar, customTheme],
  componentLoader,
  pages,
  resources: [
    CreateAdminResource(),
    CreateUserResource(),
    CreateCategoryResource(),
    CreateArticleResource(),
    CreateCommentResource(),
    CreateComplicatedResource(),
  ],
});

export const createAuthUsers = async () =>
  Promise.all(
    AuthUsers.map(async ({ email, password }) => {
      const admin = await AdminModel.findOne({ email });
      if (!admin) {
        await AdminModel.create({ email, password: await argon2.hash(password) });
      }
    }),
  );
