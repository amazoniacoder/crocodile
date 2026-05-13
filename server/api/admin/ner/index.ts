import { Router } from 'express';
import { nerBatchProcessor } from '../../../infrastructure/ner/NerBatchProcessor';

const router = Router();

// GET /api/admin/ner/metrics - Get NER batch processor metrics
router.get('/metrics', (req, res) => {
  try {
    const metrics = nerBatchProcessor.getMetrics();
    
    res.json({
      success: true,
      metrics
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch NER metrics'
    });
  }
});

export default router;