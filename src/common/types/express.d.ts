import { Role } from '../../generated/prisma/index.js';

declare global {
  namespace Express {
    interface User {
      userId: number;
      email: string;
      role: Role;
    }
    interface Request {
      user?: User;
    }
  }
}

export { };
