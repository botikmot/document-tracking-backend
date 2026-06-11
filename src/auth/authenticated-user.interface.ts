export interface AuthenticatedUser {
  userId: string;
  username: string;
  roles: string[];
  officeIds: string[];
}
