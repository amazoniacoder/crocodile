import { User } from './schema';

declare module 'express-session' {
  interface SessionData {
    user: User;
  }
}