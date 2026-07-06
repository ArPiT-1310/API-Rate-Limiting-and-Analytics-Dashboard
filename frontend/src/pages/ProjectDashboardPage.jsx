import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getProjectByIdApi } from '../api/projects.api.js';
import { getSummary, getTimeseries, getStatusBreakdown, getLogs } from '../api/analytics.api.js';

import TimeRangeSelector from '../components/TimeRangeSelector';
import StatCard from '../components/StatCard';
import RequestsOverTimeChart from '../components/RequestsOverTimeChart';
import StatusBreakdownChart from '../components/StatusBreakdownChart';
import RecentLogsTable from '../components/RecentLogsTable';

const ProjectDashboardPage = () => {
  const { id } = useParams();
  const { user, logout } = useAuth();

  // ── Project metadata ───────────────────────────────────────────────────────
  const [project, setProject] = useState(null);
  const [projectError, setProjectError] = useState('');

  // ── Range selector ─────────────────────────────────────────────────────────
  const [range, setRange] = useState('24h');

  // ── Summary section ────────────────────────────────────────────────────────
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState('');

  // ── Timeseries section ─────────────────────────────────────────────────────
  const [timeseries, setTimeseries] = useState([]);
  const [timeseriesLoading, setTimeseriesLoading] = useState(true);
  const [timeseriesError, setTimeseriesError] = useState('');

  // ── Status breakdown section ───────────────────────────────────────────────
  const [statusBreakdown, setStatusBreakdown] = useState(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [statusError, setStatusError] = useState('');

  // ── Logs section ───────────────────────────────────────────────────────────
  const [logs, setLogs] = useState([]);
  const [logsPage, setLogsPage] = useState(1);
  const [logsTotalPages, setLogsTotalPages] = useState(1);
  const [logsTotalLogs, setLogsTotalLogs] = useState(0);
  const [logsLoading, setLogsLoading] = useState(true);
  const [logsError, setLogsError] = useState('');

  // Abort controller ref for cleanup on unmount
  const abortRef = useRef(null);

  // ── Fetch project info ─────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getProjectByIdApi(id);
        if (!cancelled) setProject(data);
      } catch {
        if (!cancelled) setProjectError('Could not load project details.');
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  // ── Fetch range-dependent sections ────────────────────────────────────────
  const fetchRangeData = useCallback(async (projectId, selectedRange, signal) => {
    // Summary
    setSummaryLoading(true);
    setSummaryError('');
    getSummary(projectId, selectedRange)
      .then((data) => { if (!signal.aborted) setSummary(data); })
      .catch(() => { if (!signal.aborted) setSummaryError('Failed to load summary.'); })
      .finally(() => { if (!signal.aborted) setSummaryLoading(false); });

    // Timeseries
    setTimeseriesLoading(true);
    setTimeseriesError('');
    getTimeseries(projectId, selectedRange)
      .then((data) => { if (!signal.aborted) setTimeseries(data); })
      .catch(() => { if (!signal.aborted) setTimeseriesError('Failed to load timeseries.'); })
      .finally(() => { if (!signal.aborted) setTimeseriesLoading(false); });

    // Status Breakdown
    setStatusLoading(true);
    setStatusError('');
    getStatusBreakdown(projectId, selectedRange)
      .then((data) => { if (!signal.aborted) setStatusBreakdown(data); })
      .catch(() => { if (!signal.aborted) setStatusError('Failed to load status breakdown.'); })
      .finally(() => { if (!signal.aborted) setStatusLoading(false); });
  }, []);

  useEffect(() => {
    if (!id) return;
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    fetchRangeData(id, range, controller.signal);
    return () => controller.abort();
  }, [id, range, fetchRangeData]);

  // ── Fetch logs (not range-filtered) ───────────────────────────────────────
  const fetchLogs = useCallback(async (projectId, page) => {
    setLogsLoading(true);
    setLogsError('');
    try {
      const data = await getLogs(projectId, page, 10);
      setLogs(data.logs);
      setLogsPage(data.page);
      setLogsTotalPages(data.totalPages);
      setLogsTotalLogs(data.totalLogs);
    } catch {
      setLogsError('Failed to load logs.');
    } finally {
      setLogsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!id) return;
    fetchLogs(id, logsPage);
  }, [id, logsPage, fetchLogs]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleRangeChange = (newRange) => setRange(newRange);
  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > logsTotalPages) return;
    setLogsPage(newPage);
  };

  // ── Section skeleton ───────────────────────────────────────────────────────
  const SectionSkeleton = () => (
    <div className="skeleton-block glassmorphism">
      <div className="skeleton-line"></div>
      <div className="skeleton-line short"></div>
    </div>
  );

  const SectionError = ({ message, onRetry }) => (
    <div className="chart-card glassmorphism section-error">
      <p>{message}</p>
      <button className="btn-retry" onClick={onRetry}>Retry</button>
    </div>
  );

  return (
    <div className="dashboard-container">
      {/* Navbar */}
      <header className="dashboard-header glassmorphism">
        <div className="brand">
          <span className="brand-logo">AS</span>
          <h1>Antigravity Limiter</h1>
        </div>
        <div className="user-profile">
          <div className="user-info">
            <span className="user-name">{user?.name}</span>
            <span className="user-email">{user?.email}</span>
          </div>
          <button onClick={logout} id="logout-btn" className="btn-logout">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
            Logout
          </button>
        </div>
      </header>

      <main className="dashboard-main">
        {/* Breadcrumb + Title */}
        <div className="breadcrumb">
          <Link to="/projects">← All Projects</Link>
          {project && (
            <>
              <span className="breadcrumb-sep"> / </span>
              <Link to={`/projects/${id}/settings`}>{project.name}</Link>
            </>
          )}
        </div>

        {projectError ? (
          <div className="alert alert-error">{projectError}</div>
        ) : (
          <div className="section-header">
            <div>
              <h2>{project ? `${project.name} — Analytics` : 'Analytics Dashboard'}</h2>
              <p className="subtitle">Real-time traffic, performance, and error insights</p>
            </div>
            <TimeRangeSelector
              activeRange={range}
              onChange={handleRangeChange}
              disabled={summaryLoading && timeseriesLoading}
            />
          </div>
        )}

        {/* ── Stat Cards ─────────────────────────────────────────────────── */}
        <section className="stat-cards-grid">
          {summaryLoading ? (
            Array.from({ length: 4 }).map((_, i) => <SectionSkeleton key={i} />)
          ) : summaryError ? (
            <div className="stat-cards-error">
              <SectionError message={summaryError} onRetry={() => fetchRangeData(id, range, new AbortController().signal)} />
            </div>
          ) : (
            <>
              <StatCard label="Total Requests" value={summary?.totalRequests ?? 0} />
              <StatCard label="Avg Response Time" value={summary?.avgResponseTimeMs ?? 0} suffix=" ms" />
              <StatCard label="Error Rate" value={summary?.errorRate ?? 0} suffix="%" />
              <StatCard label="Rate Limited" value={summary?.rateLimitedCount ?? 0} />
            </>
          )}
        </section>

        {/* ── Charts Row ─────────────────────────────────────────────────── */}
        <section className="charts-grid">
          {/* Timeseries Chart */}
          {timeseriesLoading ? (
            <div className="chart-card glassmorphism"><SectionSkeleton /></div>
          ) : timeseriesError ? (
            <SectionError message={timeseriesError} onRetry={() => fetchRangeData(id, range, new AbortController().signal)} />
          ) : (
            <RequestsOverTimeChart data={timeseries} range={range} />
          )}

          {/* Status Breakdown Chart */}
          {statusLoading ? (
            <div className="chart-card glassmorphism"><SectionSkeleton /></div>
          ) : statusError ? (
            <SectionError message={statusError} onRetry={() => fetchRangeData(id, range, new AbortController().signal)} />
          ) : (
            <StatusBreakdownChart data={statusBreakdown} />
          )}
        </section>

        {/* ── Logs Table ─────────────────────────────────────────────────── */}
        <section className="logs-section">
          <RecentLogsTable
            logs={logs}
            page={logsPage}
            totalPages={logsTotalPages}
            totalLogs={logsTotalLogs}
            onPageChange={handlePageChange}
            loading={logsLoading}
            error={logsError}
            onRetry={() => fetchLogs(id, logsPage)}
          />
        </section>
      </main>
    </div>
  );
};

export default ProjectDashboardPage;
