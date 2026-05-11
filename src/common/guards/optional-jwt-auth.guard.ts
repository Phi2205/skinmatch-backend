import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest(err: any, user: any) {
    // Luôn trả về user (có thể là null) chứ không ném lỗi Unauthorized
    return user || null;
  }
}
