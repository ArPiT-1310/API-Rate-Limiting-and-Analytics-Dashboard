import React from 'react';

const StatCard = ({ label, value, suffix = '' }) => {
  const formattedValue = typeof value === 'number' 
    ? value.toLocaleString(undefined, { maximumFractionDigits: 2 })
    : value;

  return (
    <div className="stat-card glassmorphism">
      <div className="stat-value">
        {formattedValue !== undefined && formattedValue !== null ? formattedValue : '0'}
        {suffix && <span className="stat-suffix">{suffix}</span>}
      </div>
      <div className="stat-label">{label}</div>
    </div>
  );
};

export default StatCard;
