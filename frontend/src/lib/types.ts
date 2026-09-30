import type { Status } from './api';

export interface Category {
  value: string;
  label: string;
}
export interface Region {
  id: number;
  name: string;
  code: string;
  requiresKey: boolean;
}
export interface Meta {
  categories: Category[];
  regions: Region[];
  /** True on the demo site: fictional data, one-tap sign-in for every role. */
  demo: boolean;
}
export interface PoliticalDistrict {
  id: number;
  name: string;
  kind: string;
}
export interface Unit {
  id?: number;
  name: string;
  category: string;
  /** Ghana Post GPS digital address, e.g. AK-039-5028. Optional. */
  gpsAddress?: string | null;
}
export interface LocalSummary {
  id: number;
  name: string;
  chairName: string | null;
  chairPhone: string | null;
  status: Status;
  adminNote: string | null;
  submittedAt: string | null;
  updatedAt: string;
  unitCount: number;
  code?: string | null;
  units?: Unit[];
}
export interface DistrictDetail {
  id: number;
  name: string;
  regionId: number;
  regionName: string;
  regionCode: string;
  chairName: string | null;
  chairPhone: string | null;
  chairGroup: string | null;
  remarks: string | null;
  status: Status;
  adminNote: string | null;
  verified: boolean;
  submittedAt: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  code?: string | null;
  politicalDistricts: PoliticalDistrict[];
  locals: LocalSummary[];
}
export interface LocalDetail {
  id: number;
  name: string;
  districtId: number;
  districtName: string;
  regionId: number;
  regionName: string;
  regionCode: string;
  chairName: string | null;
  chairPhone: string | null;
  remarks: string | null;
  status: Status;
  adminNote: string | null;
  submittedAt: string | null;
  updatedAt: string;
  code?: string | null;
  units: Unit[];
}
