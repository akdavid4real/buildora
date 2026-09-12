import { ExecutionContext, createParamDecorator } from '@nestjs/common';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: string;
}

export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser;
    if (!user) {
      return null;
    }
    return data ? user[data] : user;
  },
);
