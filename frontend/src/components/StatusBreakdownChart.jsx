import React from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend
} from 'recharts';

const STATUS_COLORS = {
  'Success (2xx)':    '#22c55e',
  'Client Err (4xx)': '#f97316',
  'Server Err (5xx)': '#ef4444',
  'Rate Limited (429)': '#a855f7',
};

const StatusBreakdownChart = ({ data }) => {
  const chartData = data
    ? [
        { name: 'Success (2xx)',     value: data.success2xx     || 0 },
        { name: 'Client Err (4xx)',  value: data.clientError4xx || 0 },
        { name: 'Server Err (5xx)',  value: data.serverError5xx || 0 },
        { name: 'Rate Limited (429)', value: data.rateLimited429 || 0 },
      ]
    : [];

  const hasTraffic = chartData.some((d) => d.value > 0);

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div className="custom-tooltip glassmorphism">
          <p className="tooltip-date">{payload[0].name}</p>
          <p className="tooltip-item">
            Count: <strong>{payload[0].value}</strong>
          </p>
          <p className="tooltip-item">
            Share: <strong>{payload[0].payload.percent !== undefined ? `${(payload[0].payload.percent * 100).toFixed(1)}%` : ''}</strong>
          </p>
        </div>
      );
    }
    return null;
  };

  const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
    if (percent < 0.05) return null;
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    return (
      <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={600}>
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    <div className="chart-card glassmorphism">
      <h3 className="chart-title">Status Breakdown</h3>

      {!hasTraffic ? (
        <div className="chart-empty-state">
          <p>No requests yet — traffic will appear here once your proxy is used</p>
        </div>
      ) : (
        <div className="chart-container" style={{ width: '100%', height: 300 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={70}
                outerRadius={110}
                paddingAngle={3}
                dataKey="value"
                labelLine={false}
                label={renderCustomLabel}
              >
                {chartData.map((entry) => (
                  <Cell key={entry.name} fill={STATUS_COLORS[entry.name]} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend
                formatter={(value) => (
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{value}</span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

export default StatusBreakdownChart;
