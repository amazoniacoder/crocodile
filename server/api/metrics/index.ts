import { Router } from 'express';
import { register } from '../../infrastructure/monitoring/PrometheusMetrics';

const router = Router();

/**
 * GET /metrics
 * Prometheus metrics endpoint
 */
router.get('/', async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (error) {
    res.status(500).end(error);
  }
});

export default router;
