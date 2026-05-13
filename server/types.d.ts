// Express type extensions
// req.user — зарезервировано для будущей авторизации (Admin middleware)
declare global {
  namespace Express {
    interface Request {
      user?: { id: number; role: string };
    }
  }
}

export {};
