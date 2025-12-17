/**
 * Admin Dashboard Routes
 * Real-time monitoring of all webhook activities, signals, positions, and executions
 */

const express = require('express');
const router = express.Router();
const db = require('../config/db');
const logger = require('../config/logger');

/**
 * GET /admin/test
 * Test endpoint for debugging
 */
router.get('/test', async (req, res) => {
  try {
    const result = await db.query('SELECT COUNT(*) as count FROM signal_logs');
    res.json({ success: true, result: result, count: result[0] ? result[0][0]?.count : 'no data' });
  } catch (error) {
    res.json({ error: error.message, stack: error.stack });
  }
});

/**
 * GET /admin
 * Main admin dashboard with all logs
 */
router.get('/', async (req, res) => {
  try {
    // Fetch recent signals
    const signals = await db.query(`
      SELECT 
        sl.id,
        sl.strategyId,
        s.name as strategyName,
        sl.segment,
        sl.canonicalSymbol,
        sl.signal as signalValue,
        JSON_UNQUOTE(JSON_EXTRACT(sl.payload, '$.price')) as price,
        sl.signalId,
        sl.receivedAt,
        sl.payload
      FROM signal_logs sl
      LEFT JOIN strategies s ON sl.strategyId = s.id
      ORDER BY sl.receivedAt DESC
      LIMIT 50
    `);

    // Fetch recent executions
    const executions = await db.query(`
      SELECT 
        el.id,
        el.userId,
        u.name as userName,
        el.strategyId,
        s.name as strategyName,
        el.decision,
        el.reason,
        el.metadata,
        el.createdAt
      FROM execution_logs el
      LEFT JOIN users u ON el.userId = u.id
      LEFT JOIN strategies s ON el.strategyId = s.id
      ORDER BY el.createdAt DESC
      LIMIT 100
    `);

    // Fetch open positions
    const positions = await db.query(`
      SELECT 
        p.id,
        p.userId,
        u.name as userName,
        p.strategyId,
        s.name as strategyName,
        p.segment,
        p.canonicalSymbol,
        p.side,
        p.qty,
        p.entryPrice,
        p.slPrice,
        p.tpPrice,
        CASE 
          WHEN p.slPrice IS NOT NULL OR p.tpPrice IS NOT NULL THEN 'SLTP'
          ELSE 'SIGNAL_ONLY'
        END as exitMode,
        p.status,
        p.createdAt
      FROM positions p
      LEFT JOIN users u ON p.userId = u.id
      LEFT JOIN strategies s ON p.strategyId = s.id
      WHERE p.status = 'OPEN'
      ORDER BY p.createdAt DESC
    `);

    // Fetch recent order logs
    const orders = await db.query(`
      SELECT 
        ol.id,
        ol.userId,
        u.name as userName,
        ol.strategyId,
        ol.positionId,
        ol.side,
        ol.qty,
        ol.orderType,
        ol.fillPrice,
        ol.status,
        ol.brokerOrderId,
        ol.errorMessage,
        ol.createdAt
      FROM order_logs ol
      LEFT JOIN users u ON ol.userId = u.id
      ORDER BY ol.createdAt DESC
      LIMIT 100
    `);

    // Fetch statistics
    const stats = await db.query(`
      SELECT 
        (SELECT COUNT(*) FROM signal_logs WHERE DATE(receivedAt) = CURDATE()) as todaySignals,
        (SELECT COUNT(*) FROM execution_logs WHERE DATE(createdAt) = CURDATE()) as todayExecutions,
        (SELECT COUNT(*) FROM positions WHERE status='OPEN') as openPositions,
        (SELECT COUNT(DISTINCT userId) FROM execution_logs WHERE DATE(createdAt) = CURDATE()) as activeUsers,
        (SELECT COUNT(*) FROM order_logs WHERE status='FILLED' AND DATE(createdAt) = CURDATE()) as successfulOrders,
        (SELECT COUNT(*) FROM order_logs WHERE (status='REJECTED' OR status='CANCELLED') AND DATE(createdAt) = CURDATE()) as failedOrders
    `);

    const statsData = stats[0] || {
      todaySignals: 0,
      todayExecutions: 0,
      openPositions: 0,
      activeUsers: 0,
      successfulOrders: 0,
      failedOrders: 0
    };

    // Render HTML dashboard
    res.send(generateDashboardHTML(
      signals || [],
      executions || [],
      positions || [],
      orders || [],
      statsData
    ));

  } catch (error) {
    logger.error('❌ Admin dashboard error:', error);
    res.status(500).send(`
      <html>
        <head><title>Error</title></head>
        <body style="font-family: Arial; padding: 20px;">
          <h1>Error Loading Dashboard</h1>
          <p>${error.message}</p>
        </body>
      </html>
    `);
  }
});

/**
 * Generate HTML dashboard
 */
function generateDashboardHTML(signals, executions, positions, orders, stats) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AlgoEngine Admin Dashboard - Live Monitoring</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background: #f5f7fa;
      color: #333;
      padding: 20px;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 30px;
      border-radius: 10px;
      margin-bottom: 30px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
    .header h1 { font-size: 32px; margin-bottom: 5px; }
    .header p { opacity: 0.9; font-size: 14px; }
    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }
    .stat-card {
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      border-left: 4px solid #667eea;
    }
    .stat-card h3 {
      color: #666;
      font-size: 14px;
      font-weight: normal;
      margin-bottom: 10px;
    }
    .stat-card .value {
      font-size: 32px;
      font-weight: bold;
      color: #333;
    }
    .stat-card.success { border-left-color: #10b981; }
    .stat-card.warning { border-left-color: #f59e0b; }
    .stat-card.danger { border-left-color: #ef4444; }
    .stat-card.info { border-left-color: #3b82f6; }
    
    .section {
      background: white;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 30px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .section h2 {
      font-size: 20px;
      margin-bottom: 20px;
      color: #333;
      border-bottom: 2px solid #667eea;
      padding-bottom: 10px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
    }
    thead {
      background: #f8f9fa;
      position: sticky;
      top: 0;
    }
    th {
      padding: 12px 8px;
      text-align: left;
      font-weight: 600;
      color: #666;
      border-bottom: 2px solid #e5e7eb;
    }
    td {
      padding: 12px 8px;
      border-bottom: 1px solid #f0f0f0;
    }
    tr:hover {
      background: #f8f9fa;
    }
    .badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
    }
    .badge-long { background: #dcfce7; color: #166534; }
    .badge-short { background: #fee2e2; color: #991b1b; }
    .badge-flat { background: #e5e7eb; color: #374151; }
    .badge-enter { background: #dbeafe; color: #1e40af; }
    .badge-exit { background: #fef3c7; color: #92400e; }
    .badge-reverse { background: #ede9fe; color: #5b21b6; }
    .badge-skip { background: #f3f4f6; color: #6b7280; }
    .badge-open { background: #dcfce7; color: #166534; }
    .badge-closed { background: #e5e7eb; color: #6b7280; }
    .badge-success { background: #dcfce7; color: #166534; }
    .badge-failed { background: #fee2e2; color: #991b1b; }
    .badge-pending { background: #fef3c7; color: #92400e; }
    
    .timestamp {
      color: #6b7280;
      font-size: 13px;
    }
    .mono {
      font-family: 'Courier New', monospace;
      background: #f3f4f6;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 12px;
    }
    .refresh-btn {
      position: fixed;
      bottom: 30px;
      right: 30px;
      background: #667eea;
      color: white;
      border: none;
      padding: 15px 30px;
      border-radius: 50px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
      transition: all 0.3s;
    }
    .refresh-btn:hover {
      background: #5568d3;
      transform: translateY(-2px);
      box-shadow: 0 6px 16px rgba(102, 126, 234, 0.5);
    }
    .auto-refresh {
      color: #10b981;
      font-size: 14px;
      margin-left: 10px;
    }
    @media (max-width: 768px) {
      .stats { grid-template-columns: 1fr; }
      table { font-size: 12px; }
      th, td { padding: 8px 4px; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>🚀 AlgoEngine Admin Dashboard</h1>
    <p>Real-time monitoring of webhook signals, executions, positions & orders</p>
    <p style="margin-top: 5px; font-size: 12px;">
      <strong>Last Updated:</strong> ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST
      <span class="auto-refresh">● Auto-refresh every 10s</span>
    </p>
  </div>

  <!-- Statistics Cards -->
  <div class="stats">
    <div class="stat-card info">
      <h3>Today's Signals</h3>
      <div class="value">${stats.todaySignals}</div>
    </div>
    <div class="stat-card success">
      <h3>Today's Executions</h3>
      <div class="value">${stats.todayExecutions}</div>
    </div>
    <div class="stat-card warning">
      <h3>Open Positions</h3>
      <div class="value">${stats.openPositions}</div>
    </div>
    <div class="stat-card info">
      <h3>Active Users Today</h3>
      <div class="value">${stats.activeUsers}</div>
    </div>
    <div class="stat-card success">
      <h3>Successful Orders</h3>
      <div class="value">${stats.successfulOrders}</div>
    </div>
    <div class="stat-card danger">
      <h3>Failed Orders</h3>
      <div class="value">${stats.failedOrders}</div>
    </div>
  </div>

  <!-- Recent Signals -->
  <div class="section">
    <h2>📡 Recent Webhook Signals (Last 50)</h2>
    <div style="overflow-x: auto;">
      <table>
        <thead>
          <tr>
            <th>Time</th>
            <th>Strategy</th>
            <th>Signal</th>
            <th>Symbol</th>
            <th>Segment</th>
            <th>Price</th>
            <th>Signal ID</th>
          </tr>
        </thead>
        <tbody>
          ${signals.map(s => `
            <tr>
              <td class="timestamp">${new Date(s.receivedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</td>
              <td><strong>${s.strategyName || 'N/A'}</strong> <span class="mono">#${s.strategyId}</span></td>
              <td>
                ${s.signalValue === 1 ? '<span class="badge badge-long">LONG</span>' : 
                  s.signalValue === -1 ? '<span class="badge badge-short">SHORT</span>' : 
                  '<span class="badge badge-flat">EXIT</span>'}
              </td>
              <td><strong>${s.canonicalSymbol}</strong></td>
              <td>${s.segment || '-'}</td>
              <td>${s.price ? '₹' + parseFloat(s.price).toLocaleString() : '-'}</td>
              <td class="mono" style="font-size: 11px;">${s.signalId || '-'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  </div>

  <!-- Open Positions -->
  <div class="section">
    <h2>📊 Open Positions (${positions.length})</h2>
    <div style="overflow-x: auto;">
      <table>
        <thead>
          <tr>
            <th>User</th>
            <th>Strategy</th>
            <th>Symbol</th>
            <th>Side</th>
            <th>Qty</th>
            <th>Entry Price</th>
            <th>SL</th>
            <th>TP</th>
            <th>Exit Mode</th>
            <th>Opened At</th>
          </tr>
        </thead>
        <tbody>
          ${positions.length === 0 ? 
            '<tr><td colspan="10" style="text-align: center; padding: 40px; color: #999;">No open positions</td></tr>' :
            positions.map(p => `
            <tr>
              <td><strong>${p.userName}</strong> <span class="mono">#${p.userId}</span></td>
              <td>${p.strategyName} <span class="mono">#${p.strategyId}</span></td>
              <td><strong>${p.canonicalSymbol}</strong></td>
              <td>
                ${p.side === 'LONG' ? '<span class="badge badge-long">LONG</span>' : 
                  '<span class="badge badge-short">SHORT</span>'}
              </td>
              <td><strong>${p.qty}</strong></td>
              <td>₹${parseFloat(p.entryPrice).toLocaleString()}</td>
              <td>${p.slPrice ? '₹' + parseFloat(p.slPrice).toLocaleString() : '-'}</td>
              <td>${p.tpPrice ? '₹' + parseFloat(p.tpPrice).toLocaleString() : '-'}</td>
              <td>${p.exitMode || '-'}</td>
              <td class="timestamp">${new Date(p.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  </div>

  <!-- Recent Executions -->
  <div class="section">
    <h2>⚡ Recent Executions (Last 100)</h2>
    <div style="overflow-x: auto;">
      <table>
        <thead>
          <tr>
            <th>Time</th>
            <th>User</th>
            <th>Strategy</th>
            <th>Decision</th>
            <th>Reason</th>
          </tr>
        </thead>
        <tbody>
          ${executions.map(e => `
            <tr>
              <td class="timestamp">${new Date(e.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</td>
              <td><strong>${e.userName}</strong> <span class="mono">#${e.userId}</span></td>
              <td>${e.strategyName} <span class="mono">#${e.strategyId}</span></td>
              <td>
                ${e.decision === 'ENTER' ? '<span class="badge badge-enter">ENTER</span>' :
                  e.decision === 'EXIT' ? '<span class="badge badge-exit">EXIT</span>' :
                  e.decision === 'REVERSE' ? '<span class="badge badge-reverse">REVERSE</span>' :
                  '<span class="badge badge-skip">SKIP</span>'}
              </td>
              <td>${e.reason || '-'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  </div>

  <!-- Recent Orders -->
  <div class="section">
    <h2>📝 Recent Order Logs (Last 100)</h2>
    <div style="overflow-x: auto;">
      <table>
        <thead>
          <tr>
            <th>Time</th>
            <th>User</th>
            <th>Side</th>
            <th>Qty</th>
            <th>Price</th>
            <th>Status</th>
            <th>Broker Order ID</th>
            <th>Error</th>
          </tr>
        </thead>
        <tbody>
          ${orders.map(o => `
            <tr>
              <td class="timestamp">${new Date(o.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</td>
              <td><strong>${o.userName}</strong> <span class="mono">#${o.userId}</span></td>
              <td>
                ${o.side === 'BUY' ? '<span class="badge badge-long">BUY</span>' : 
                  '<span class="badge badge-short">SELL</span>'}
              </td>
              <td><strong>${o.qty}</strong></td>
              <td>${o.fillPrice ? '₹' + parseFloat(o.fillPrice).toLocaleString() : '-'}</td>
              <td>
                ${o.status === 'FILLED' ? '<span class="badge badge-success">FILLED</span>' :
                  o.status === 'REJECTED' || o.status === 'CANCELLED' ? '<span class="badge badge-failed">FAILED</span>' :
                  '<span class="badge badge-pending">PENDING</span>'}
              </td>
              <td class="mono" style="font-size: 11px;">${o.brokerOrderId || '-'}</td>
              <td style="color: #ef4444; font-size: 12px;">${o.errorMessage || '-'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  </div>

  <button class="refresh-btn" onclick="location.reload()">
    🔄 Refresh Now
  </button>

  <script>
    // Auto-refresh every 10 seconds
    setTimeout(() => {
      location.reload();
    }, 10000);
  </script>
</body>
</html>
  `;
}

module.exports = router;
