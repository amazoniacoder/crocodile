declare module 'express-ws' {
  import { Application } from 'express';
  import { Server } from 'http';
  import { WebSocket } from 'ws';

  interface WebSocketExpressInstance {
    app: Application;
    getWss(): WebSocket.Server;
    applyTo(router: any): void;
  }

  function expressWs(app: Application, server?: Server): WebSocketExpressInstance;

  export = expressWs;
}