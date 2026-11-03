const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { clientUrls, nodeEnv, platformFeePercent } = require('./config/env');
const { ID_TYPES, WEEKDAYS, COUNCIL_TYPES, CERTIFICATE_MAX_BYTES } = require('./config/constants');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();

app.use(helmet());
// In development this allows the three demo ports (5173-5175) as well. The
// Vite proxy makes API calls same-origin anyway; this matters for direct calls.
app.use(cors({ origin: clientUrls }));
app.use(express.json({ limit: '100kb' }));
if (nodeEnv !== 'test') app.use(morgan('dev'));

app.get('/api/health', (_req, res) => res.json({ ok: true }));

// Public config so the React app shows the same commission and enums as the
// server enforces. Trades and their minimum rates come from GET /api/trades.
app.get('/api/config', (_req, res) => {
  res.json({
    platformFeePercent,
    idTypes: ID_TYPES,
    weekdays: WEEKDAYS,
    councilTypes: COUNCIL_TYPES,
    certificateMaxBytes: CERTIFICATE_MAX_BYTES,
    currency: 'INR',
  });
});

app.use('/api/trades', require('./routes/tradeRoutes'));
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/profile', require('./routes/profileRoutes'));
app.use('/api', require('./routes/userRoutes'));
app.use('/api/jobs', require('./routes/jobRoutes'));
app.use('/api/applications', require('./routes/applicationRoutes'));
app.use('/api/reviews', require('./routes/reviewRoutes'));
app.use('/api/background-checks', require('./routes/backgroundCheckRoutes'));
app.use('/api/iti-certificates', require('./routes/itiRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));

app.use(notFound);
app.use(errorHandler);

module.exports = app;
