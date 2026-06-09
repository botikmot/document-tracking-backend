import type { Request } from 'express';

export type AuthenticatedUser = {
  userId: string;
  username: string;
  roles: string[];
  officeIds: string[];
};

export type AuthenticatedRequest = Request & {
  user: AuthenticatedUser;
};
