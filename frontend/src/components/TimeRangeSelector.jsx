import React from 'react';

const TimeRangeSelector = ({ activeRange, onChange, disabled = false }) => {
  const ranges = [
    { value: '24h', label: '24 Hours' },
    { value: '7d', label: '7 Days' },
    { value: '30d', label: '30 Days' }
  ];

  return (
    <div className="time-range-selector glassmorphism">
      {ranges.map((r) => (
        <button
          key={r.value}
          type="button"
          disabled={disabled}
          onClick={() => onChange(r.value)}
          className={`range-btn ${activeRange === r.value ? 'active' : ''}`}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
};

export default TimeRangeSelector;
