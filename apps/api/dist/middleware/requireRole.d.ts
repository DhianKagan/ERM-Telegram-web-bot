export default function requireRole(role: string): (req: import("../types/request").RequestWithUser, res: import("express").Response, next: import("express").NextFunction) => void;
