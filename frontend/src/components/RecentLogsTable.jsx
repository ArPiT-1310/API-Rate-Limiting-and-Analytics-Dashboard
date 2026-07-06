import React from 'react';

const RecentLogsTable = ({ logs = [], page, totalPages, totalLogs, onPageChange, loading, error, onRetry }) => {
  const formatTimestamp = (ts) => {
    try {
      return new Date(ts).toLocaleString(undefined, {
        month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: true,
      });
    } catch {
      return ts;
    }
  };

  const getStatusClass = (code) => {
    if (code >= 500) return 'status-5xx';
    if (code === 429) return 'status-429';
    if (code >= 400) return 'status-4xx';
    return 'status-2xx';
  };

  if (error) {
    return (
      <div className="chart-card glassmorphism">
        <h3 className="chart-title">Recent Logs</h3>
        <div className="section-error">
          <p>Failed to load logs.</p>
          <button className="btn-retry" onClick={onRetry}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="chart-card glassmorphism">
      <div className="chart-title-row">
        <h3 className="chart-title">Recent Logs</h3>
        {totalLogs > 0 && (
          <span className="logs-count">{totalLogs} total</span>
        )}
      </div>

      {loading ? (
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading logs...</p>
        </div>
      ) : logs.length === 0 ? (
        <div className="chart-empty-state">
          <p>No requests yet — traffic will appear here once your proxy is used</p>
        </div>
      ) : (
        <>
          <div className="table-wrapper">
            <table className="logs-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Method</th>
                  <th>Endpoint</th>
                  <th>Status</th>
                  <th>Latency</th>
                  <th>Rate Limited</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log._id || log.id}>
                    <td className="log-timestamp">{formatTimestamp(log.timestamp)}</td>
                    <td>
                      <span className={`method-badge method-${(log.method || 'GET').toLowerCase()}`}>
                        {log.method || 'GET'}
                      </span>
                    </td>
                    <td className="log-endpoint" title={log.endpoint}>{log.endpoint}</td>
                    <td>
                      <span className={`status-badge ${getStatusClass(log.statusCode)}`}>
                        {log.statusCode}
                      </span>
                    </td>
                    <td className="log-latency">{log.responseTimeMs} ms</td>
                    <td>
                      {log.wasRateLimited ? (
                        <span className="badge badge-danger">Yes</span>
                      ) : (
                        <span className="badge badge-success">No</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="pagination">
              <button
                className="btn-secondary btn-sm"
                onClick={() => onPageChange(page - 1)}
                disabled={page <= 1}
              >
                ← Previous
              </button>
              <span className="page-info">
                Page {page} of {totalPages}
              </span>
              <button
                className="btn-secondary btn-sm"
                onClick={() => onPageChange(page + 1)}
                disabled={page >= totalPages}
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default RecentLogsTable;
