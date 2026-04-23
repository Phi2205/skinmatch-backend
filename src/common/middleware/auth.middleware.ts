import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // For now, just continue or throw depending on requirements
      return next();
    }

    const token = authHeader.split(' ')[1];
    
    try {
      // TODO: Implement JWT validation
      // const payload = this.jwtService.verify(token);
      // req.user = { userId: payload.sub, email: payload.email };
      next();
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
  }
}
