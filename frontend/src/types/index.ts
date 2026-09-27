export interface MasterRate {
  _id: string;
  serviceName: string;
  masterRate: number;
  vedaSharePercent: number;
  sodaniSharePercent: number;
  createdAt: string;
  updatedAt: string;
}

export interface BillingRecord {
  _id: string;
  sNo: number | string;
  billingGroup: string;
  billServiceDate: string;
  billDateRaw?: string;
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
  isMatched: boolean;
  billingMonth?: string;
  billingMonthKey?: string;
  batchName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BillingMonthSummary {
  monthKey: string;
  monthName: string;
  count: number;
  totalNet: number;
  totalVeda: number;
  totalSodani: number;
}

export interface BillingStats {
  totalQty: number;
  totalGross: number;
  totalDiscount: number;
  totalNet: number;
  totalMasterAmount: number;
  totalVedaShare: number;
  totalSodaniShare: number;
  unmatchedCount: number;
}

export interface UnmatchedServiceItem {
  serviceName: string;
  occurrenceCount: number;
  sampleRate: number;
  totalQty: number;
}
