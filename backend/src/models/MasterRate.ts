import mongoose, { Schema, Document } from 'mongoose';

export interface IMasterRate extends Document {
  serviceName: string;
  masterRate: number;
  vedaSharePercent: number;
  sodaniSharePercent: number;
  createdAt: Date;
  updatedAt: Date;
}

const MasterRateSchema: Schema = new Schema(
  {
    serviceName: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    masterRate: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    vedaSharePercent: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      max: 100,
    },
    sodaniSharePercent: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      max: 100,
    },
  },
  {
    timestamps: true,
    collection: 'master_rates',
  }
);

export const MasterRate = mongoose.model<IMasterRate>('MasterRate', MasterRateSchema);
