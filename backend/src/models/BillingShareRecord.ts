import mongoose, { Schema, Document } from 'mongoose';

export interface IBillingShareRecord extends Document {
  sNo: number | string;
  billingGroup: string;
  billServiceDate: string;
  billDateRaw?: Date;
  billNo: string;
  visitId: string;
  patientName: string;
  serviceName: string;
  qty: number;
  totalAmt: number;
  discAmt: number;
  netAmt: number;
  rate: number;
  percent: string | number;
  masterRate: number;
  masterAmount: number;
  vedaSharePercent: number;
  sodaniSharePercent: number;
  vedaShare: number;
  sodaniShare: number;
  billingMonth?: string;
  billingMonthKey?: string;
  batchName?: string;
  batchId?: string;
  rowIndex?: number;
  createdAt: Date;
  updatedAt: Date;
}

const BillingShareRecordSchema: Schema = new Schema(
  {
    sNo: { type: Schema.Types.Mixed, default: '' },
    rowIndex: { type: Number, default: 0 },
    billingGroup: { type: String, default: '', trim: true },
    billServiceDate: { type: String, default: '' },
    billDateRaw: { type: Date },
    billNo: { type: String, default: '', trim: true },
    visitId: { type: String, default: '', trim: true },
    patientName: { type: String, default: '', trim: true },
    serviceName: { type: String, required: true, trim: true },
    qty: { type: Number, default: 1 },
    totalAmt: { type: Number, default: 0 },
    discAmt: { type: Number, default: 0 },
    netAmt: { type: Number, default: 0 },
    rate: { type: Number, default: 0 },
    percent: { type: Schema.Types.Mixed, default: '' },
    masterRate: { type: Number, default: 0 },
    masterAmount: { type: Number, default: 0 },
    vedaSharePercent: { type: Number, default: 0 },
    sodaniSharePercent: { type: Number, default: 0 },
    vedaShare: { type: Number, default: 0 },
    sodaniShare: { type: Number, default: 0 },
    isMatched: { type: Boolean, default: false },
    billingMonth: { type: String, default: '', trim: true },
    billingMonthKey: { type: String, default: '', trim: true },
    batchName: { type: String, default: '' },
    batchId: { type: String, default: 'default' },
  },
  {
    timestamps: true,
    collection: 'billing_share_records',
  }
);

BillingShareRecordSchema.index({ serviceName: 1 });
BillingShareRecordSchema.index({ billNo: 1 });
BillingShareRecordSchema.index({ patientName: 1 });
BillingShareRecordSchema.index({ billingGroup: 1 });
BillingShareRecordSchema.index({ isMatched: 1 });
BillingShareRecordSchema.index({ billingMonth: 1 });
BillingShareRecordSchema.index({ billingMonthKey: 1 });
BillingShareRecordSchema.index({ rowIndex: 1 });
BillingShareRecordSchema.index({ billingMonthKey: 1, rowIndex: 1 });

export const BillingShareRecord = mongoose.model<IBillingShareRecord>(
  'BillingShareRecord',
  BillingShareRecordSchema
);
