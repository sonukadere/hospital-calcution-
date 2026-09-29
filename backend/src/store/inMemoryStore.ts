/**
 * In-Memory Data Store
 * 
 * Replaces MongoDB/Mongoose for fully server-side processing.
 * - Master Rates: seeded from masterRates.json, editable at runtime (resets on restart)
 * - Billing Records: purely in-memory, uploaded via Excel, processed and exported without DB
 * 
 * No database installation required.
 */

import masterRatesJson from '../data/masterRates.json';

// Type for the JSON structure
interface MasterRateJsonEntry {
  serviceName: string;
  rate: number;
  sodaniShare: number;
  vedaShare: number;
}

// ─── Types ───────────────────────────────────────────────────────────────

export interface IMasterRate {
  _id: string;
  serviceName: string;
  masterRate: number;
  vedaSharePercent: number;
  sodaniSharePercent: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IBillingShareRecord {
  _id: string;
  sNo: number | string;
  rowIndex: number;
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
  isMatched: boolean;
  billingMonth: string;
  billingMonthKey: string;
  batchName: string;
  batchId: string;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Store ───────────────────────────────────────────────────────────────

class InMemoryStore {
  masterRates: IMasterRate[] = [];
  billingRecords: IBillingShareRecord[] = [];

  constructor() {
    this.seedMasterRates();
  }

  private seedMasterRates() {
    this.masterRates = masterRatesJson.map((mr: any) => {
      const vedaPct = Math.min(100, Math.max(0, Number(mr.vedaShare) || 0));
      const sodaniPct = Math.min(100, Math.max(0, Number(mr.sodaniShare) || 0));
      return {
        _id: generateId(),
        serviceName: String(mr.serviceName).trim(),
        masterRate: Number(mr.rate) || 0,
        vedaSharePercent: vedaPct,
        sodaniSharePercent: sodaniPct,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    });
    console.log(`📦 In-Memory Store: Seeded ${this.masterRates.length} master rates from JSON`);
  }

  // ─── Master Rate Operations ──────────────────────────────────────

  findAllMasterRates(): IMasterRate[] {
    return [...this.masterRates];
  }

  findMasterRates(filter: {
    search?: string;
    category?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    page?: number;
    limit?: number;
  }): { rates: IMasterRate[]; total: number; counts: any; pagination?: any } {
    let filtered = [...this.masterRates];

    // Search filter
    if (filter.search) {
      const regex = new RegExp(filter.search.trim(), 'i');
      filtered = filtered.filter(r => regex.test(r.serviceName));
    }

    // Category filter
    if (filter.category === 'CT') {
      filtered = filtered.filter(r => /(^|\s|\/)CT(\s|\/|$)/i.test(r.serviceName));
    } else if (filter.category === 'XRAY') {
      filtered = filtered.filter(r => /X-?RAY/i.test(r.serviceName));
    } else if (filter.category === 'SONO') {
      filtered = filtered.filter(r => /(SONO|DOPPLER|MAMMO|USG|^CD\s)/i.test(r.serviceName));
    } else if (filter.category === 'PATHOLOGY') {
      filtered = filtered.filter(r =>
        !/(^|\s|\/)CT(\s|\/|$)/i.test(r.serviceName) &&
        !/X-?RAY/i.test(r.serviceName) &&
        !/(SONO|DOPPLER|MAMMO|USG|^CD\s)/i.test(r.serviceName)
      );
    }

    // Counts across all master rates (not filtered)
    const all = this.masterRates;
    const counts = {
      all: all.length,
      ct: all.filter(r => /(^|\s|\/)CT(\s|\/|$)/i.test(r.serviceName)).length,
      xray: all.filter(r => /X-?RAY/i.test(r.serviceName)).length,
      sono: all.filter(r => /(SONO|DOPPLER|MAMMO|USG|^CD\s)/i.test(r.serviceName)).length,
      pathology: 0,
    };
    counts.pathology = Math.max(0, counts.all - counts.ct - counts.xray - counts.sono);

    // Sort
    const sortField = filter.sortBy || 'serviceName';
    const sortDir = filter.sortOrder === 'desc' ? -1 : 1;
    filtered.sort((a: any, b: any) => {
      const av = a[sortField];
      const bv = b[sortField];
      if (typeof av === 'string') return av.localeCompare(bv) * sortDir;
      return ((av || 0) - (bv || 0)) * sortDir;
    });

    const total = filtered.length;

    // Pagination
    if (filter.page && filter.limit) {
      const skip = (filter.page - 1) * filter.limit;
      const paginated = filtered.slice(skip, skip + filter.limit);
      return {
        rates: paginated,
        counts,
        total,
        pagination: {
          total,
          page: filter.page,
          limit: filter.limit,
          totalPages: Math.ceil(total / filter.limit),
        },
      };
    }

    return { rates: filtered, counts, total };
  }

  findMasterRateById(id: string): IMasterRate | undefined {
    return this.masterRates.find(r => r._id === id);
  }

  findMasterRateByName(name: string): IMasterRate | undefined {
    const regex = new RegExp(`^${escapeRegex(name.trim())}$`, 'i');
    return this.masterRates.find(r => regex.test(r.serviceName));
  }

  createMasterRate(data: { serviceName: string; masterRate: number; vedaSharePercent: number; sodaniSharePercent: number }): IMasterRate {
    const now = new Date();
    const rate: IMasterRate = {
      _id: generateId(),
      serviceName: data.serviceName,
      masterRate: data.masterRate,
      vedaSharePercent: data.vedaSharePercent,
      sodaniSharePercent: data.sodaniSharePercent,
      createdAt: now,
      updatedAt: now,
    };
    this.masterRates.push(rate);
    return rate;
  }

  updateMasterRate(id: string, data: Partial<IMasterRate>): IMasterRate | null {
    const index = this.masterRates.findIndex(r => r._id === id);
    if (index === -1) return null;

    this.masterRates[index] = {
      ...this.masterRates[index],
      ...data,
      updatedAt: new Date(),
    };
    return this.masterRates[index];
  }

  deleteMasterRate(id: string): IMasterRate | null {
    const index = this.masterRates.findIndex(r => r._id === id);
    if (index === -1) return null;
    return this.masterRates.splice(index, 1)[0];
  }

  clearAllMasterRates(): void {
    this.masterRates = [];
  }

  countMasterRates(): number {
    return this.masterRates.length;
  }

  // ─── Billing Record Operations ───────────────────────────────────

  insertBillingRecords(records: Omit<IBillingShareRecord, '_id' | 'createdAt' | 'updatedAt'>[]): IBillingShareRecord[] {
    const now = new Date();
    const newRecords = records.map(r => ({
      ...r,
      _id: generateId(),
      createdAt: now,
      updatedAt: now,
    })) as IBillingShareRecord[];
    this.billingRecords.push(...newRecords);
    return newRecords;
  }

  findBillingRecords(filter: {
    search?: string;
    billingGroup?: string;
    monthKey?: string;
    isMatched?: string;
    category?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): {
    records: IBillingShareRecord[];
    total: number;
    pagination: any;
    stats: any;
    billingGroups: string[];
    availableMonths: any[];
    modalityCounts: any;
  } {
    let filtered = [...this.billingRecords];

    // Month filter
    if (filter.monthKey && filter.monthKey !== 'ALL') {
      filtered = filtered.filter(r => r.billingMonthKey === filter.monthKey!.trim());
    }

    // Search filter
    if (filter.search) {
      const regex = new RegExp(filter.search.trim(), 'i');
      filtered = filtered.filter(r =>
        regex.test(r.patientName) ||
        regex.test(r.billNo) ||
        regex.test(r.visitId) ||
        regex.test(r.serviceName)
      );
    }

    // Billing group filter
    if (filter.billingGroup && filter.billingGroup !== 'ALL') {
      filtered = filtered.filter(r => r.billingGroup === filter.billingGroup!.trim());
    }

    // Matched filter
    if (filter.isMatched !== undefined && filter.isMatched !== '') {
      const matched = filter.isMatched === 'true';
      filtered = filtered.filter(r => r.isMatched === matched);
    }

    // Category filter
    if (filter.category === 'CT') {
      filtered = filtered.filter(r => /(^|\s|\/)CT(\s|\/|$)/i.test(r.serviceName));
    } else if (filter.category === 'XRAY') {
      filtered = filtered.filter(r => /X-?RAY/i.test(r.serviceName));
    } else if (filter.category === 'SONO') {
      filtered = filtered.filter(r => /(SONO|DOPPLER|MAMMO|USG|^CD\s)/i.test(r.serviceName));
    } else if (filter.category === 'PATHOLOGY') {
      filtered = filtered.filter(r =>
        !/(^|\s|\/)CT(\s|\/|$)/i.test(r.serviceName) &&
        !/X-?RAY/i.test(r.serviceName) &&
        !/(SONO|DOPPLER|MAMMO|USG|^CD\s)/i.test(r.serviceName)
      );
    }

    // Sort
    const sortField = filter.sortBy === 'sNo' || filter.sortBy === 'rowIndex' ? 'rowIndex' : (filter.sortBy || 'rowIndex');
    const sortDir = filter.sortOrder === 'desc' ? -1 : 1;
    filtered.sort((a: any, b: any) => {
      const av = a[sortField];
      const bv = b[sortField];
      if (typeof av === 'string') return av.localeCompare(bv) * sortDir;
      return ((av || 0) - (bv || 0)) * sortDir;
    });

    const total = filtered.length;

    // Stats
    const stats = filtered.reduce((acc, r) => {
      acc.totalQty += r.qty || 0;
      acc.totalGross += r.totalAmt || 0;
      acc.totalDiscount += r.discAmt || 0;
      acc.totalNet += r.netAmt || 0;
      acc.totalMasterAmount += r.masterAmount || 0;
      acc.totalVedaShare += r.vedaShare || 0;
      acc.totalSodaniShare += r.sodaniShare || 0;
      if (!r.isMatched) acc.unmatchedCount++;
      return acc;
    }, {
      totalQty: 0, totalGross: 0, totalDiscount: 0, totalNet: 0,
      totalMasterAmount: 0, totalVedaShare: 0, totalSodaniShare: 0, unmatchedCount: 0,
    });

    stats.totalGross = Math.round(stats.totalGross * 100) / 100;
    stats.totalDiscount = Math.round(stats.totalDiscount * 100) / 100;
    stats.totalNet = Math.round(stats.totalNet * 100) / 100;
    stats.totalMasterAmount = Math.round(stats.totalMasterAmount * 100) / 100;
    stats.totalVedaShare = Math.round(stats.totalVedaShare * 100) / 100;
    stats.totalSodaniShare = Math.round(stats.totalSodaniShare * 100) / 100;

    // Modality counts (scoped to month if filter set)
    const modalityBase = (filter.monthKey && filter.monthKey !== 'ALL')
      ? this.billingRecords.filter(r => r.billingMonthKey === filter.monthKey)
      : this.billingRecords;

    const modalityCounts = {
      all: modalityBase.length,
      ct: modalityBase.filter(r => /(^|\s|\/)CT(\s|\/|$)/i.test(r.serviceName)).length,
      xray: modalityBase.filter(r => /X-?RAY/i.test(r.serviceName)).length,
      sono: modalityBase.filter(r => /(SONO|DOPPLER|MAMMO|USG|^CD\s)/i.test(r.serviceName)).length,
      pathology: 0,
    };
    modalityCounts.pathology = Math.max(0, modalityCounts.all - modalityCounts.ct - modalityCounts.xray - modalityCounts.sono);

    // Available months
    const monthMap = new Map<string, { name: string; count: number; totalNet: number; totalVeda: number; totalSodani: number }>();
    this.billingRecords.forEach(r => {
      const key = r.billingMonthKey || 'unknown';
      const existing = monthMap.get(key) || { name: r.billingMonth || 'Unknown Month', count: 0, totalNet: 0, totalVeda: 0, totalSodani: 0 };
      existing.count++;
      existing.totalNet += r.netAmt || 0;
      existing.totalVeda += r.vedaShare || 0;
      existing.totalSodani += r.sodaniShare || 0;
      monthMap.set(key, existing);
    });

    const availableMonths = Array.from(monthMap.entries())
      .map(([key, val]) => ({
        monthKey: key,
        monthName: val.name,
        count: val.count,
        totalNet: Math.round(val.totalNet * 100) / 100,
        totalVeda: Math.round(val.totalVeda * 100) / 100,
        totalSodani: Math.round(val.totalSodani * 100) / 100,
      }))
      .sort((a, b) => b.monthKey.localeCompare(a.monthKey));

    // Billing groups
    const billingGroups = [...new Set(modalityBase.map(r => r.billingGroup).filter(Boolean))];

    // Paginate
    const page = filter.page || 1;
    const limit = filter.limit || 50;
    const skip = (page - 1) * limit;
    const paginated = filtered.slice(skip, skip + limit);

    return {
      records: paginated,
      total,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
      stats,
      billingGroups,
      availableMonths,
      modalityCounts,
    };
  }

  getAllBillingRecords(): IBillingShareRecord[] {
    return [...this.billingRecords];
  }

  getBillingRecordsForExport(filter: {
    search?: string;
    billingGroup?: string;
    monthKey?: string;
    isMatched?: string;
    category?: string;
  }): IBillingShareRecord[] {
    let filtered = [...this.billingRecords];

    if (filter.monthKey && filter.monthKey !== 'ALL') {
      filtered = filtered.filter(r => r.billingMonthKey === filter.monthKey!.trim());
    }
    if (filter.search) {
      const regex = new RegExp(filter.search.trim(), 'i');
      filtered = filtered.filter(r =>
        regex.test(r.patientName) || regex.test(r.billNo) || regex.test(r.visitId) || regex.test(r.serviceName)
      );
    }
    if (filter.billingGroup && filter.billingGroup !== 'ALL') {
      filtered = filtered.filter(r => r.billingGroup === filter.billingGroup!.trim());
    }
    if (filter.isMatched !== undefined && filter.isMatched !== '') {
      filtered = filtered.filter(r => r.isMatched === (filter.isMatched === 'true'));
    }
    if (filter.category === 'CT') {
      filtered = filtered.filter(r => /(^|\s|\/)CT(\s|\/|$)/i.test(r.serviceName));
    } else if (filter.category === 'XRAY') {
      filtered = filtered.filter(r => /X-?RAY/i.test(r.serviceName));
    } else if (filter.category === 'SONO') {
      filtered = filtered.filter(r => /(SONO|DOPPLER|MAMMO|USG|^CD\s)/i.test(r.serviceName));
    } else if (filter.category === 'PATHOLOGY') {
      filtered = filtered.filter(r =>
        !/(^|\s|\/)CT(\s|\/|$)/i.test(r.serviceName) &&
        !/X-?RAY/i.test(r.serviceName) &&
        !/(SONO|DOPPLER|MAMMO|USG|^CD\s)/i.test(r.serviceName)
      );
    }

    filtered.sort((a, b) => (a.rowIndex || 0) - (b.rowIndex || 0));
    return filtered;
  }

  deleteBillingByMonthKeys(monthKeys: string[]): number {
    const before = this.billingRecords.length;
    this.billingRecords = this.billingRecords.filter(r => !monthKeys.includes(r.billingMonthKey));
    return before - this.billingRecords.length;
  }

  deleteBillingByMonthKey(monthKey: string): number {
    const before = this.billingRecords.length;
    this.billingRecords = this.billingRecords.filter(r => r.billingMonthKey !== monthKey);
    return before - this.billingRecords.length;
  }

  clearAllBillingRecords(): number {
    const count = this.billingRecords.length;
    this.billingRecords = [];
    return count;
  }

  countBillingRecords(): number {
    return this.billingRecords.length;
  }

  updateBillingRecordsForService(serviceName: string, masterRate: number, vedaPct: number, sodaniPct: number): number {
    const regex = new RegExp(`^${escapeRegex(serviceName)}$`, 'i');
    const percentStr = `Veda: ${vedaPct}% | Sodani: ${sodaniPct}%`;
    let updated = 0;

    this.billingRecords.forEach((rec, idx) => {
      if (regex.test(rec.serviceName)) {
        const qty = rec.qty || 1;
        const masterAmount = Math.round(masterRate * qty * 100) / 100;
        const vedaShare = Math.round(((masterAmount * vedaPct) / 100) * 100) / 100;
        const sodaniShare = Math.round(((masterAmount * sodaniPct) / 100) * 100) / 100;

        this.billingRecords[idx] = {
          ...rec,
          masterRate,
          masterAmount,
          vedaSharePercent: vedaPct,
          sodaniSharePercent: sodaniPct,
          percent: percentStr,
          vedaShare,
          sodaniShare,
          isMatched: true,
          updatedAt: new Date(),
        };
        updated++;
      }
    });
    return updated;
  }

  resetBillingForService(serviceName: string): number {
    const regex = new RegExp(`^${escapeRegex(serviceName)}$`, 'i');
    let updated = 0;

    this.billingRecords.forEach((rec, idx) => {
      if (regex.test(rec.serviceName)) {
        this.billingRecords[idx] = {
          ...rec,
          masterRate: 0,
          masterAmount: 0,
          vedaSharePercent: 0,
          sodaniSharePercent: 0,
          vedaShare: 0,
          sodaniShare: 0,
          isMatched: false,
          updatedAt: new Date(),
        };
        updated++;
      }
    });
    return updated;
  }

  resetAllBillingShares(): void {
    this.billingRecords.forEach((rec, idx) => {
      this.billingRecords[idx] = {
        ...rec,
        masterRate: 0,
        masterAmount: 0,
        vedaSharePercent: 0,
        sodaniSharePercent: 0,
        percent: '-',
        vedaShare: 0,
        sodaniShare: 0,
        isMatched: false,
        updatedAt: new Date(),
      };
    });
  }

  getUnmatchedServices(): { serviceName: string; occurrenceCount: number; sampleRate: number; totalQty: number }[] {
    const unmatched = this.billingRecords.filter(r => !r.isMatched);
    const grouped = new Map<string, { count: number; sampleRate: number; totalQty: number }>();

    unmatched.forEach(r => {
      const key = r.serviceName;
      const existing = grouped.get(key) || { count: 0, sampleRate: r.rate, totalQty: 0 };
      existing.count++;
      existing.totalQty += r.qty || 0;
      grouped.set(key, existing);
    });

    return Array.from(grouped.entries())
      .map(([serviceName, data]) => ({
        serviceName,
        occurrenceCount: data.count,
        sampleRate: data.sampleRate,
        totalQty: data.totalQty,
      }))
      .sort((a, b) => b.occurrenceCount - a.occurrenceCount);
  }
}

// ─── Utilities ───────────────────────────────────────────────────────────

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

let _idCounter = 0;
function generateId(): string {
  _idCounter++;
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 8);
  return `${ts}${rand}${_idCounter}`;
}

// ─── Singleton Export ────────────────────────────────────────────────────

export const store = new InMemoryStore();
