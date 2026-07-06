import mongoose from 'mongoose';

const requestLogSchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: [true, 'Project ID is required'],
      index: true,
    },
    endpoint: {
      type: String,
      required: [true, 'Endpoint is required'],
    },
    method: {
      type: String,
      required: [true, 'Method is required'],
    },
    statusCode: {
      type: Number,
      required: [true, 'Status code is required'],
    },
    responseTimeMs: {
      type: Number,
      required: [true, 'Response time is required'],
    },
    wasRateLimited: {
      type: Boolean,
      default: false,
    },
    ipAddress: {
      type: String,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: false,
    toJSON: {
      transform: (doc, ret) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
    toObject: {
      transform: (doc, ret) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Compound index for analytics: queries will filter by projectId and sort/range by timestamp
requestLogSchema.index({ projectId: 1, timestamp: -1 });

const RequestLog = mongoose.model('RequestLog', requestLogSchema);

export default RequestLog;
