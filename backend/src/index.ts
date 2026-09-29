import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import router from './routes/api';
import { store } from './store/inMemoryStore';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

// CORS setup
app.use(
  cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Request logger
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// API routes
app.use('/api', router);

// Health check
app.get(['/', '/health', '/api/health'], async (_req, res) => {
  try {
    const rateCount = store.countMasterRates();
    const recordCount = store.countBillingRecords();

    res.json({
      status: 'ok',
      database: 'IN-MEMORY (No DB Required)',
      metrics: {
        masterRates: rateCount,
        billingRecords: recordCount,
      },
      timestamp: new Date(),
    });
  } catch (err: any) {
    res.status(500).json({
      status: 'error',
      database: 'IN-MEMORY',
      error: err.message,
      timestamp: new Date(),
    });
  }
});

function startServer() {
  // No database connection needed — data is in-memory
  const server = app.listen(PORT, () => {
    console.log(`🚀 Pure Share Management Backend running on http://localhost:${PORT}`);
    console.log(`📦 Mode: IN-MEMORY (No Database Required)`);
    console.log(`📊 Loaded: ${store.countMasterRates()} Master Rates | ${store.countBillingRecords()} Billing Records`);
    console.log(`💡 Data lives in server memory — Excel upload → process → export`);
  });

  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n❌ Error: Port ${PORT} is already in use.`);
    } else {
      console.error('❌ Server startup error:', err);
    }
    process.exit(1);
  });
}

startServer();
