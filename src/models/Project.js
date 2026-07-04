import mongoose from 'mongoose';
import crypto from 'crypto';

const projectSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Project name is required'],
      trim: true,
    },
    targetBaseUrl: {
      type: String,
      required: [true, 'Target base URL is required'],
      trim: true,
      validate: {
        validator: function (v) {
          return /^https?:\/\//.test(v);
        },
        message: (props) =>
          `${props.value} is not a valid URL. It must start with http:// or https://`,
      },
    },
    // Auto-generated on creation — not settable by the client
    apiKey: {
      type: String,
      required: true,
      unique: true,
      default: () => crypto.randomBytes(16).toString('hex'),
    },
    rateLimit: {
      windowMs: {
        type: Number,
        default: 60000,
      },
      maxRequests: {
        type: Number,
        default: 100,
      },
    },
    createdAt: {
      type: Date,
      default: Date.now,
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

const Project = mongoose.model('Project', projectSchema);

export default Project;
