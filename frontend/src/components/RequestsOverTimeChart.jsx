import React from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';

const RequestsOverTimeChart = ({ data = [], range }) => {
  // Check if there is any traffic in the dataset
  const hasTraffic = data.some((d) => d.count > 0);

  const formatXAxis = (tickItem) => {
    try {
      const date = new Date(tickItem);
      if (range === '24h') {
        // e.g., "02 PM"
        return date.toLocaleTimeString(undefined, { hour: '2-digit', hour12: true }).toUpperCase();
      } else {
        // e.g., "Jul 05"
        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      }
    } catch (e) {
      return tickItem;
    }
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const date = new Date(label);
      const formattedDate = date.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });

      return (
        <div className="custom-tooltip glassmorphism">
          <p className="tooltip-date">{formattedDate}</p>
          <p className="tooltip-item requests">
            <span className="dot requests-dot"></span>
            Requests: <strong>{payload[0].value}</strong>
          </p>
          <p className="tooltip-item latency">
            <span className="dot latency-dot"></span>
            Avg Latency: <strong>{payload[1]?.value ?? 0} ms</strong>
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="chart-card glassmorphism">
      <h3 className="chart-title">Request Volume & Latency</h3>
      
      {!hasTraffic ? (
        <div className="chart-empty-state">
          <p>No requests yet — traffic will appear here once your proxy is used</p>
        </div>
      ) : (
        <div className="chart-container" style={{ width: '100%', height: 300 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={data}
              margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="colorRequests" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--accent-color)" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="var(--accent-color)" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorLatency" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--warning-color)" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="var(--warning-color)" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" />
              <XAxis 
                dataKey="bucket" 
                tickFormatter={formatXAxis} 
                stroke="var(--text-secondary)"
                style={{ fontSize: '0.75rem' }}
              />
              <YAxis 
                yAxisId="left" 
                stroke="var(--accent-color)"
                style={{ fontSize: '0.75rem' }}
                label={{ value: 'Requests', angle: -90, position: 'insideLeft', style: { fill: 'var(--accent-color)', fontSize: '0.75rem' } }}
              />
              <YAxis 
                yAxisId="right" 
                orientation="right" 
                stroke="var(--warning-color)"
                style={{ fontSize: '0.75rem' }}
                label={{ value: 'Latency (ms)', angle: 90, position: 'insideRight', style: { fill: 'var(--warning-color)', fontSize: '0.75rem' } }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend verticalAlign="top" height={36} />
              <Area 
                yAxisId="left"
                type="monotone" 
                dataKey="count" 
                name="Requests" 
                stroke="var(--accent-color)" 
                fillOpacity={1} 
                fill="url(#colorRequests)" 
                strokeWidth={2}
              />
              <Area 
                yAxisId="right"
                type="monotone" 
                dataKey="avgResponseTimeMs" 
                name="Latency (ms)" 
                stroke="var(--warning-color)" 
                fillOpacity={1} 
                fill="url(#colorLatency)" 
                strokeWidth={1.5}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

export default RequestsOverTimeChart;
