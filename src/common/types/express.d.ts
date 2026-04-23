import { Role } from '../../generated/prisma/client.js';

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
