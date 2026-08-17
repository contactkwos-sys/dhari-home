export type Manufacturer = 'Jaisal Fashion Weave' | 'Other'

export type Platform =
  | 'Flipkart'
  | 'Amazon'
  | 'Meesho'
  | 'Myntra'
  | 'Website'
  | 'Other'

export type PaymentStatus = 'Prepaid' | 'COD Pending' | 'COD Received'
export type MovementType = 'IN' | 'OUT'
export type DnoSize = '5ft x 4ft' | '7ft x 4ft'
export type AppRole = 'Owner' | 'Warehouse'

export interface DnoMaster {
  id: string
  dno_number: string
  photo_url: string | null
  manufacturer: Manufacturer
  other_manufacturer_name: string | null
  purchase_rate: number | null
  category: string | null
  hsn_code: string | null
  gst_rate: number
  date_added: string
  low_stock_threshold: number
}

export interface StockMovement {
  id: string
  dno_id: string
  type: MovementType
  qty: number
  date: string
  note: string | null
  size: DnoSize
  dno_master?: Pick<DnoMaster, 'dno_number'> | null
}

export interface Order {
  id: string
  order_date: string
  dno_id: string
  platform: Platform
  platform_order_id: string | null
  pieces: number
  sale_rate: number
  buyer_name: string | null
  buyer_state: string | null
  courier: string | null
  awb_number: string | null
  payment_status: PaymentStatus
  invoice_no: string | null
  size: DnoSize
  dno_master?: Pick<
    DnoMaster,
    'dno_number' | 'hsn_code' | 'gst_rate' | 'category'
  > | null
}

export interface StockRow {
  dno: DnoMaster
  size: DnoSize
  inbound: number
  outbound: number
  balance: number
}

export interface LowStockItem {
  dno: DnoMaster
  size: DnoSize
  balance: number
  threshold: number
}

export const PLATFORMS: Platform[] = [
  'Flipkart',
  'Amazon',
  'Meesho',
  'Myntra',
  'Website',
  'Other',
]

export const PAYMENT_STATUSES: PaymentStatus[] = [
  'Prepaid',
  'COD Pending',
  'COD Received',
]

export const SIZES: DnoSize[] = ['5ft x 4ft', '7ft x 4ft']

export const APP_ROLES: AppRole[] = ['Owner', 'Warehouse']

export const INDIAN_STATES = [
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
  'Andaman and Nicobar Islands',
  'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi',
  'Jammu and Kashmir',
  'Ladakh',
  'Lakshadweep',
  'Puducherry',
]

/** Extract a readable message from Supabase / thrown values. */
export function errorMessage(
  error: unknown,
  fallback = 'Something went wrong',
): string {
  if (error instanceof Error && error.message) return error.message
  if (error && typeof error === 'object' && 'message' in error) {
    const msg = (error as { message?: unknown }).message
    if (typeof msg === 'string' && msg) return msg
  }
  if (typeof error === 'string' && error) return error
  return fallback
}
