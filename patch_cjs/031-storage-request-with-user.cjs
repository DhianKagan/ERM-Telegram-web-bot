#!/usr/bin/env node
// patch: 031-storage-request-with-user.cjs
// purpose: привести маршруты storage к типу RequestWithUser для доступа к req.user
const fs = require('fs');
const path = require('path');

const targetPath = path.resolve('apps/api/src/routes/storage.ts');
let source = fs.readFileSync(targetPath, 'utf8');

const importBlock = `import {\n  Router,\n  RequestHandler,\n  NextFunction,\n  Request,\n  Response,\n} from 'express';`;
const updatedImportBlock = `import {\n  Router,\n  RequestHandler,\n  NextFunction,\n  Response,\n} from 'express';`;
if (!source.includes(importBlock)) {
  throw new Error('unexpected import block');
}
source = source.replace(importBlock, updatedImportBlock);

const taskSyncImport = "import TaskSyncController from '../controllers/taskSync.controller';";
const requestWithUserImport = "import type RequestWithUser from '../types/request';";
if (!source.includes(requestWithUserImport)) {
  source = source.replace(
    taskSyncImport,
    `${taskSyncImport}\nimport type RequestWithUser from '../types/request';`,
  );
}

source = source.replace(
  '  async (req: Request, res: Response) => {',
  '  async (req: RequestWithUser, res: Response) => {',
);

source = source.replace(
  '  async (req, res) => {',
  '  async (req: RequestWithUser, res: Response) => {',
);

source = source.replace(
  '  async (req, res, next: NextFunction) => {',
  '  async (req: RequestWithUser, res: Response, next: NextFunction) => {',
);

fs.writeFileSync(targetPath, source, 'utf8');
console.log('updated ' + path.relative(process.cwd(), targetPath));
